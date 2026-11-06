/**
 * Local mirror of planner_vehicles for Account picker, balances, and Planner
 * (own + partner rows when Pair mode is mirrored).
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
  vehicle_type: string;
  annual_rate: number;
  growth_mode: string;
  compound_period: string;
  plan_amount: number | null;
  plan_cadence: string | null;
  notes: string | null;
  created_at: string;
};

const UPSERT_SQL = `
INSERT INTO vehicles_local (
  id, user_id, name, balance, is_default, deleted_at, updated_at,
  vehicle_type, annual_rate, growth_mode, compound_period,
  plan_amount, plan_cadence, notes, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  name = excluded.name,
  balance = excluded.balance,
  is_default = excluded.is_default,
  deleted_at = excluded.deleted_at,
  updated_at = excluded.updated_at,
  vehicle_type = excluded.vehicle_type,
  annual_rate = excluded.annual_rate,
  growth_mode = excluded.growth_mode,
  compound_period = excluded.compound_period,
  plan_amount = excluded.plan_amount,
  plan_cadence = excluded.plan_cadence,
  notes = excluded.notes,
  created_at = excluded.created_at
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
    vehicle_type: row.vehicle_type,
    annual_rate: row.annual_rate,
    growth_mode: row.growth_mode,
    compound_period: row.compound_period,
    plan_amount: row.plan_amount,
    plan_cadence: row.plan_cadence,
    notes: row.notes,
    created_at: row.created_at,
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

/** Full PlannerVehicle shape from the local mirror (defaults for older lite rows). */
export function toPlannerVehicle(row: VehicleLocalRow): PlannerVehicle {
  const growth =
    row.growth_mode === 'shrink' ? 'shrink' : 'grow';
  const period =
    row.compound_period === 'monthly' ? 'monthly' : 'yearly';
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    vehicle_type: (row.vehicle_type || 'other') as PlannerVehicle['vehicle_type'],
    balance: row.balance,
    annual_rate: row.annual_rate ?? 0,
    growth_mode: growth,
    compound_period: period,
    plan_amount: row.plan_amount,
    plan_cadence: (row.plan_cadence as PlannerVehicle['plan_cadence']) ?? null,
    notes: row.notes,
    is_default: row.is_default === 1,
    deleted_at: row.deleted_at,
    created_at: row.created_at || row.updated_at,
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
    row.vehicle_type,
    row.annual_rate,
    row.growth_mode,
    row.compound_period,
    row.plan_amount,
    row.plan_cadence,
    row.notes,
    row.created_at,
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
    vehicle_type: String(row.vehicle_type ?? 'other'),
    annual_rate: Number(row.annual_rate ?? 0),
    growth_mode: String(row.growth_mode ?? 'grow'),
    compound_period: String(row.compound_period ?? 'yearly'),
    plan_amount:
      row.plan_amount == null || row.plan_amount === ''
        ? null
        : Number(row.plan_amount),
    plan_cadence:
      row.plan_cadence == null || row.plan_cadence === ''
        ? null
        : String(row.plan_cadence),
    notes: row.notes == null || row.notes === '' ? null : String(row.notes),
    created_at: String(row.created_at ?? row.updated_at ?? ''),
  };
}
