/**
 * Planner goals / partner cache offline mirror (Pair Planner).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import type { PlannerGoal } from '../plannerGoals.ts';
import {
  listActiveGoalsLocal,
  replaceGoalsLocal,
} from './goalsLocal.ts';
import {
  readPartnerCache,
  savePartnerCache,
} from './partnerCache.ts';
import {
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import {
  listActiveVehiclesLocal,
  replaceVehiclesLocal,
  toPlannerVehicle,
  vehicleFromRemote,
} from './vehiclesLocal.ts';
import type { PlannerVehicle } from '../plannerVehicles.ts';

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
    async all<Row>(sql, params: readonly SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const rows =
        params.length === 0 ? stmt.all() : stmt.all(...(params as SqlValue[]));
      return rows as Row[];
    },
    async first<Row>(sql, params: readonly SqlValue[] = []) {
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

function sampleVehicle(
  partial: Partial<PlannerVehicle> & Pick<PlannerVehicle, 'id' | 'user_id'>
): PlannerVehicle {
  return {
    name: 'Savings',
    vehicle_type: 'savings',
    balance: 100,
    annual_rate: 4,
    growth_mode: 'grow',
    compound_period: 'yearly',
    plan_amount: null,
    plan_cadence: null,
    notes: null,
    is_default: false,
    deleted_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

function sampleGoal(
  partial: Partial<PlannerGoal> & Pick<PlannerGoal, 'id' | 'user_id'>
): PlannerGoal {
  return {
    name: 'Emergency',
    goal_type: 'emergency',
    target_amount: 1000,
    target_date: null,
    current_saved: 0,
    plan_amount: null,
    plan_cadence: null,
    notes: null,
    vehicle_ids: [],
    deleted_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

describe('pair planner offline mirror', () => {
  it('mirrors own + partner vehicles separately by user_id', async () => {
    const db = await freshDb();
    const own = sampleVehicle({ id: 'v-own', user_id: 'user-a', balance: 50 });
    const partner = sampleVehicle({
      id: 'v-partner',
      user_id: 'user-b',
      name: 'Partner cash',
      balance: 200,
    });
    await replaceVehiclesLocal(db, 'user-a', [vehicleFromRemote(own)]);
    await replaceVehiclesLocal(db, 'user-b', [vehicleFromRemote(partner)]);

    const ownRows = await listActiveVehiclesLocal(db, 'user-a');
    const partnerRows = await listActiveVehiclesLocal(db, 'user-b');
    assert.equal(ownRows.length, 1);
    assert.equal(partnerRows.length, 1);
    assert.equal(toPlannerVehicle(ownRows[0]!).balance, 50);
    assert.equal(toPlannerVehicle(partnerRows[0]!).name, 'Partner cash');
  });

  it('mirrors goals with linked vehicle ids (incl. partner vehicle)', async () => {
    const db = await freshDb();
    const goal = sampleGoal({
      id: 'g1',
      user_id: 'user-a',
      vehicle_ids: ['v-own', 'v-partner'],
    });
    await replaceGoalsLocal(db, 'user-a', [goal]);
    const listed = await listActiveGoalsLocal(db, 'user-a');
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0]!.vehicle_ids.sort(), ['v-own', 'v-partner']);
  });

  it('caches active partner link for offline Pair chrome', async () => {
    const db = await freshDb();
    await savePartnerCache(db, 'user-a', {
      id: 'link-1',
      status: 'active',
      inviteCode: null,
      isCreator: true,
      partnerId: 'user-b',
      partnerDisplayName: 'Alex',
      createdAt: '2026-11-01T00:00:00.000Z',
      linkedAt: '2026-11-02T00:00:00.000Z',
    });
    const cached = await readPartnerCache(db, 'user-a');
    assert.ok(cached);
    assert.equal(cached!.status, 'active');
    assert.equal(cached!.partnerId, 'user-b');
    assert.equal(cached!.partnerDisplayName, 'Alex');
  });
});
