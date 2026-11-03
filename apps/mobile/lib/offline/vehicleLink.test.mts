/**
 * Linked Planner account on offline transactions: local balance + outbox snapshots.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import type { TransactionInput } from '../transactionModel.ts';
import { listPendingOutbox } from './outbox.ts';
import {
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import {
  createLocalTransaction,
  softDeleteLocalTransaction,
  updateLocalTransaction,
  type TransactionsRepoOptions,
} from './transactionsRepo.ts';
import {
  getVehicleLocal,
  upsertVehicleLocal,
} from './vehiclesLocal.ts';

function nodeSql(db: DatabaseSync): SqlExecutor {
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      const stmt = db.prepare(sql);
      if (params.length === 0) stmt.run();
      else stmt.run(...(params as SqlValue[]));
    },
    async all<Row>(sql: string, params: readonly SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const rows =
        params.length === 0 ? stmt.all() : stmt.all(...(params as SqlValue[]));
      return rows as Row[];
    },
    async first<Row>(sql: string, params: readonly SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const row =
        params.length === 0 ? stmt.get() : stmt.get(...(params as SqlValue[]));
      return (row as Row | undefined) ?? null;
    },
  };
}

async function freshDb(): Promise<SqlExecutor> {
  const db = nodeSql(new DatabaseSync(':memory:'));
  await migrateOfflineSchema(db);
  return db;
}

function optionsFor(db: SqlExecutor): TransactionsRepoOptions {
  let n = 0;
  return {
    db,
    now: () => `2026-11-03T12:00:${String(n++).padStart(2, '0')}.000Z`,
    newId: () => `id-${n}`,
  };
}

async function seedVehicle(
  db: SqlExecutor,
  balance = 100,
  isDefault = 1
): Promise<void> {
  await upsertVehicleLocal(db, {
    id: 'veh-a',
    user_id: 'user-a',
    name: 'Savings',
    balance,
    is_default: isDefault,
    deleted_at: null,
    updated_at: '2026-11-01T00:00:00.000Z',
  });
}

function expense(partial: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: 10,
    type: 'expense',
    category: 'Groceries',
    occurred_at: '2026-11-03T12:00:00.000Z',
    vehicle_id: 'veh-a',
    ...partial,
  };
}

describe('offline vehicle link', () => {
  it('expense subtracts local balance and stores absolute snapshot', async () => {
    const db = await freshDb();
    await seedVehicle(db, 100);
    const options = optionsFor(db);

    const created = await createLocalTransaction(
      'user-a',
      expense({ amount: 15 }),
      'HKD',
      options
    );
    assert.equal(created.vehicle_id, 'veh-a');

    const vehicle = await getVehicleLocal(db, 'user-a', 'veh-a');
    assert.equal(vehicle?.balance, 85);

    const pending = await listPendingOutbox(db, 'user-a', created.id);
    assert.equal(pending.length, 1);
    const payload = JSON.parse(pending[0].payload_json) as {
      balance_snapshots?: { vehicle_id: string; balance: number }[];
    };
    assert.deepEqual(payload.balance_snapshots, [
      { vehicle_id: 'veh-a', balance: 85 },
    ]);
  });

  it('income adds to local balance', async () => {
    const db = await freshDb();
    await seedVehicle(db, 50, 0);
    const options = optionsFor(db);

    await createLocalTransaction(
      'user-a',
      expense({ amount: 20, type: 'income', category: 'Salary' }),
      'HKD',
      options
    );

    const vehicle = await getVehicleLocal(db, 'user-a', 'veh-a');
    assert.equal(vehicle?.balance, 70);
  });

  it('null account leaves balance unchanged', async () => {
    const db = await freshDb();
    await seedVehicle(db, 100);
    const options = optionsFor(db);

    await createLocalTransaction(
      'user-a',
      expense({ vehicle_id: null, amount: 25 }),
      'HKD',
      options
    );

    const vehicle = await getVehicleLocal(db, 'user-a', 'veh-a');
    assert.equal(vehicle?.balance, 100);
  });

  it('edit reverses prior effect and applies the new amount', async () => {
    const db = await freshDb();
    await seedVehicle(db, 100);
    const options = optionsFor(db);

    const created = await createLocalTransaction(
      'user-a',
      expense({ amount: 10 }),
      'HKD',
      options
    );
    assert.equal((await getVehicleLocal(db, 'user-a', 'veh-a'))?.balance, 90);

    await updateLocalTransaction(
      'user-a',
      created.id,
      expense({ amount: 30 }),
      options
    );
    assert.equal((await getVehicleLocal(db, 'user-a', 'veh-a'))?.balance, 70);
  });

  it('delete of never-synced create restores balance and drops outbox', async () => {
    const db = await freshDb();
    await seedVehicle(db, 100);
    const options = optionsFor(db);

    const created = await createLocalTransaction(
      'user-a',
      expense({ amount: 10 }),
      'HKD',
      options
    );
    await softDeleteLocalTransaction('user-a', created.id, options);

    assert.equal((await getVehicleLocal(db, 'user-a', 'veh-a'))?.balance, 100);
    assert.equal((await listPendingOutbox(db, 'user-a')).length, 0);
  });

  it('schema migrates to v3 with vehicles_local', async () => {
    const db = await freshDb();
    const version = await db.first<{ user_version: number }>(
      'PRAGMA user_version'
    );
    assert.equal(Number(version?.user_version), 3);
    const cols = await db.all<{ name: string }>(
      'PRAGMA table_info(transactions_local)'
    );
    assert.ok(cols.some((c) => c.name === 'vehicle_id'));
  });
});
