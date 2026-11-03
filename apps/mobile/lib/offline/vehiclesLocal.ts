/**
 * Local mirror of planner_vehicles for Account picker + linked balance updates.
 * Does not create accounts offline — only caches rows and patches balance/default.
 */
import type { PlannerVehicle } from '@/lib/plannerVehicles';
import {
  applyBalanceDelta,
  type BalanceDelta,
  type BalanceSnapshot,
} from '@/lib/vehicleBalance';

import type { SqlExecutor, SqlValue } from './schema';

export type VehicleLocalRow = {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  is_default: number; // SQLite 0/1
  deleted_at: string | null;
  updated_at: string;
};

const UPSERT_SQL = `
INSERT INTO vehicles_local (
  id, user_id, name, balance, is_default, deleted_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  name = excluded.name,
  balance = excluded.balance,
  is_default = excluded.is_default,
  deleted_at = excluded.deleted_at,
  updated_at = excluded.updated_at
`;

export function vehicleFromRemote(row: PlannerVehicle): VehicleLocalRow {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    balance: row.balance,
    is_default: row.is_default ? 1 : 0,
    deleted_at: row.deleted_at,
    updated_at: row.updated_at,
  };
}

export function toPlannerVehicleLite(row: VehicleLocalRow): Pick<
  PlannerVehicle,
  'id' | 'user_id' | 'name' | 'balance' | 'is_default' | 'deleted_at' | 'updated_at'
> {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    balance: row.balance,
    is_default: row.is_default === 1,
    deleted_at: row.deleted_at,
    updated_at: row.updated_at,
  };
}

export async function upsertVehicleLocal(
  db: SqlExecutor,
  row: VehicleLocalRow
): Promise<void> {
  await db.run(UPSERT_SQL, rowParams(row));
}

export async function replaceVehiclesLocal(
  db: SqlExecutor,
  userId: string,
  rows: VehicleLocalRow[]
): Promise<void> {
  await db.run('DELETE FROM vehicles_local WHERE user_id = ?', [userId]);
  for (const row of rows) {
    await upsertVehicleLocal(db, row);
  }
}

export async function listActiveVehiclesLocal(
  db: SqlExecutor,
  userId: string
): Promise<VehicleLocalRow[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM vehicles_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY is_default DESC, name COLLATE NOCASE ASC`,
    [userId]
  );
  return rows.map(mapRow);
}

export async function getVehicleLocal(
  db: SqlExecutor,
  userId: string,
  id: string
): Promise<VehicleLocalRow | null> {
  const row = await db.first<Record<string, unknown>>(
    `SELECT * FROM vehicles_local
     WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
    [userId, id]
  );
  return row ? mapRow(row) : null;
}

export async function getDefaultVehicleLocal(
  db: SqlExecutor,
  userId: string
): Promise<VehicleLocalRow | null> {
  const row = await db.first<Record<string, unknown>>(
    `SELECT * FROM vehicles_local
     WHERE user_id = ? AND deleted_at IS NULL AND is_default = 1
     LIMIT 1`,
    [userId]
  );
  return row ? mapRow(row) : null;
}

/** Apply signed deltas; return absolute snapshots for outbox. */
export async function applyLocalBalanceDeltas(
  db: SqlExecutor,
  userId: string,
  deltas: readonly BalanceDelta[]
): Promise<BalanceSnapshot[]> {
  const snapshots: BalanceSnapshot[] = [];
  for (const { vehicle_id, delta } of deltas) {
    const existing = await getVehicleLocal(db, userId, vehicle_id);
    if (!existing) continue;
    const balance = applyBalanceDelta(existing.balance, delta);
    await db.run(
      `UPDATE vehicles_local SET balance = ?, updated_at = ?
       WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
      [balance, new Date().toISOString(), userId, vehicle_id]
    );
    snapshots.push({ vehicle_id, balance });
  }
  return snapshots;
}

export async function removeVehiclesLocal(
  db: SqlExecutor,
  userId: string
): Promise<void> {
  await db.run('DELETE FROM vehicles_local WHERE user_id = ?', [userId]);
}

function rowParams(row: VehicleLocalRow): SqlValue[] {
  return [
    row.id,
    row.user_id,
    row.name,
    row.balance,
    row.is_default,
    row.deleted_at,
    row.updated_at,
  ];
}

function mapRow(row: Record<string, unknown>): VehicleLocalRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    balance: Number(row.balance),
    is_default: Number(row.is_default) ? 1 : 0,
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    updated_at: String(row.updated_at),
  };
}
