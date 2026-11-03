/**
 * On-device schema for transactions-only offline (plan §5).
 * Versioned with SQLite `user_version`. No Supabase migration.
 */

export const OFFLINE_SCHEMA_VERSION = 4;

export type SqlValue = string | number | null;

/** Small async SQL surface shared by expo-sqlite and the Node test driver. */
export type SqlExecutor = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  first<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row | null>;
};

export const OFFLINE_SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS transactions_local (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category TEXT NOT NULL,
  note TEXT,
  currency TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  recurring_series_id TEXT,
  occurrence_key TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pending_op TEXT CHECK (
    pending_op IS NULL OR pending_op IN ('create', 'update', 'delete')
  )
);

CREATE INDEX IF NOT EXISTS transactions_local_user_idx
  ON transactions_local (user_id);

CREATE INDEX IF NOT EXISTS transactions_local_occurred_idx
  ON transactions_local (occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_local_updated_idx
  ON transactions_local (updated_at);

CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entity TEXT NOT NULL CHECK (entity = 'transaction'),
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create', 'update', 'soft_delete')),
  payload_json TEXT NOT NULL,
  base_updated_at TEXT,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'acked', 'failed'))
);

CREATE INDEX IF NOT EXISTS outbox_entity_pending_idx
  ON outbox (user_id, entity, entity_id, status, seq);

CREATE TABLE IF NOT EXISTS sync_meta (
  user_id TEXT PRIMARY KEY NOT NULL,
  last_pulled_at TEXT,
  last_sync_at TEXT,
  last_sync_error TEXT
);
`;

/** Last-known custom categories for offline transaction create. */
export const OFFLINE_SCHEMA_V2_SQL = `
CREATE TABLE IF NOT EXISTS category_cache (
  user_id TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
`;

/**
 * Planner account link: vehicle_id on local txns + vehicles mirror for
 * Account picker / balance / default preselect.
 */
export const OFFLINE_SCHEMA_V3_SQL = `
ALTER TABLE transactions_local ADD COLUMN vehicle_id TEXT;

CREATE TABLE IF NOT EXISTS vehicles_local (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  deleted_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS vehicles_local_user_idx
  ON vehicles_local (user_id);

CREATE INDEX IF NOT EXISTS vehicles_local_default_idx
  ON vehicles_local (user_id, is_default)
  WHERE deleted_at IS NULL AND is_default = 1;
`;

/**
 * Transfer TYPE: widen type CHECK + transfer_to_vehicle_id column.
 * SQLite cannot ALTER CHECK, so rebuild transactions_local.
 */
export const OFFLINE_SCHEMA_V4_SQL = `
CREATE TABLE IF NOT EXISTS transactions_local_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  category TEXT NOT NULL,
  note TEXT,
  currency TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  recurring_series_id TEXT,
  occurrence_key TEXT,
  vehicle_id TEXT,
  transfer_to_vehicle_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pending_op TEXT CHECK (
    pending_op IS NULL OR pending_op IN ('create', 'update', 'delete')
  )
);

INSERT INTO transactions_local_v4 (
  id, user_id, amount, type, category, note, currency, occurred_at,
  recurring_series_id, occurrence_key, vehicle_id, transfer_to_vehicle_id,
  deleted_at, created_at, updated_at, pending_op
)
SELECT
  id, user_id, amount, type, category, note, currency, occurred_at,
  recurring_series_id, occurrence_key, vehicle_id, NULL,
  deleted_at, created_at, updated_at, pending_op
FROM transactions_local;

DROP TABLE transactions_local;

ALTER TABLE transactions_local_v4 RENAME TO transactions_local;

CREATE INDEX IF NOT EXISTS transactions_local_user_idx
  ON transactions_local (user_id);

CREATE INDEX IF NOT EXISTS transactions_local_occurred_idx
  ON transactions_local (occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_local_updated_idx
  ON transactions_local (updated_at);
`;

export async function readUserVersion(db: SqlExecutor): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const version = Number(row?.user_version ?? 0);
  return Number.isFinite(version) ? version : 0;
}

/** Apply local schema migrations. Safe to call more than once. */
export async function migrateOfflineSchema(db: SqlExecutor): Promise<void> {
  let current = await readUserVersion(db);
  if (current >= OFFLINE_SCHEMA_VERSION) return;
  if (current < 1) {
    await db.exec(OFFLINE_SCHEMA_V1_SQL);
    await db.exec('PRAGMA user_version = 1');
    current = 1;
  }
  if (current < 2) {
    await db.exec(OFFLINE_SCHEMA_V2_SQL);
    await db.exec('PRAGMA user_version = 2');
    current = 2;
  }
  if (current < 3) {
    await db.exec(OFFLINE_SCHEMA_V3_SQL);
    await db.exec('PRAGMA user_version = 3');
    current = 3;
  }
  if (current < 4) {
    await db.exec(OFFLINE_SCHEMA_V4_SQL);
    await db.exec('PRAGMA user_version = 4');
  }
}

export async function withSqlTransaction(
  db: SqlExecutor,
  task: () => Promise<void>
): Promise<void> {
  await db.exec('BEGIN IMMEDIATE');
  try {
    await task();
    await db.exec('COMMIT');
  } catch (error) {
    try {
      await db.exec('ROLLBACK');
    } catch {
      // The original error is the one callers need.
    }
    throw error;
  }
}
