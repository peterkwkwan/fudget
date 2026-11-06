/**
 * Local mirror of planner_goals + planner_goal_vehicles for Planner Pair/Personal
 * offline read. Owner writes stay online (no planner outbox).
 */
import type { PlannerGoal } from '@/lib/plannerGoals';

import type { SqlExecutor, SqlValue } from './schema';

export type GoalLocalRow = {
  id: string;
  user_id: string;
  name: string;
  goal_type: string;
  target_amount: number;
  target_date: string | null;
  current_saved: number;
  plan_amount: number | null;
  plan_cadence: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalVehicleLocalRow = {
  goal_id: string;
  vehicle_id: string;
  user_id: string;
  created_at: string;
};

const UPSERT_GOAL_SQL = `
INSERT INTO goals_local (
  id, user_id, name, goal_type, target_amount, target_date, current_saved,
  plan_amount, plan_cadence, notes, deleted_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  name = excluded.name,
  goal_type = excluded.goal_type,
  target_amount = excluded.target_amount,
  target_date = excluded.target_date,
  current_saved = excluded.current_saved,
  plan_amount = excluded.plan_amount,
  plan_cadence = excluded.plan_cadence,
  notes = excluded.notes,
  deleted_at = excluded.deleted_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at
`;

const UPSERT_LINK_SQL = `
INSERT INTO goal_vehicles_local (
  goal_id, vehicle_id, user_id, created_at
) VALUES (?, ?, ?, ?)
ON CONFLICT(goal_id, vehicle_id) DO UPDATE SET
  user_id = excluded.user_id,
  created_at = excluded.created_at
`;

export function goalFromRemote(goal: PlannerGoal): GoalLocalRow {
  return {
    id: goal.id,
    user_id: goal.user_id,
    name: goal.name,
    goal_type: goal.goal_type,
    target_amount: goal.target_amount,
    target_date: goal.target_date,
    current_saved: goal.current_saved,
    plan_amount: goal.plan_amount,
    plan_cadence: goal.plan_cadence,
    notes: goal.notes,
    deleted_at: goal.deleted_at,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
  };
}

export function toPlannerGoal(
  row: GoalLocalRow,
  vehicleIds: string[]
): PlannerGoal {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    goal_type: row.goal_type as PlannerGoal['goal_type'],
    target_amount: row.target_amount,
    target_date: row.target_date,
    current_saved: row.current_saved,
    plan_amount: row.plan_amount,
    plan_cadence: row.plan_cadence as PlannerGoal['plan_cadence'],
    notes: row.notes,
    vehicle_ids: vehicleIds,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertGoalLocal(
  db: SqlExecutor,
  row: GoalLocalRow
): Promise<void> {
  await db.run(UPSERT_GOAL_SQL, goalParams(row));
}

export async function replaceGoalsLocal(
  db: SqlExecutor,
  userId: string,
  goals: PlannerGoal[]
): Promise<void> {
  await db.run('DELETE FROM goal_vehicles_local WHERE user_id = ?', [userId]);
  await db.run('DELETE FROM goals_local WHERE user_id = ?', [userId]);
  const now = new Date().toISOString();
  for (const goal of goals) {
    await upsertGoalLocal(db, goalFromRemote(goal));
    for (const vehicleId of goal.vehicle_ids) {
      await db.run(UPSERT_LINK_SQL, [goal.id, vehicleId, userId, now]);
    }
  }
}

export async function listActiveGoalsLocal(
  db: SqlExecutor,
  userId: string
): Promise<PlannerGoal[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM goals_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [userId]
  );
  const goals = rows.map(mapGoalRow);
  if (goals.length === 0) return [];

  const links = await db.all<Record<string, unknown>>(
    `SELECT goal_id, vehicle_id FROM goal_vehicles_local WHERE user_id = ?`,
    [userId]
  );
  const byGoal = new Map<string, string[]>();
  for (const link of links) {
    const gid = String(link.goal_id);
    const list = byGoal.get(gid) ?? [];
    list.push(String(link.vehicle_id));
    byGoal.set(gid, list);
  }
  return goals.map((g) => toPlannerGoal(g, byGoal.get(g.id) ?? []));
}

export async function removeGoalsLocal(
  db: SqlExecutor,
  userId: string
): Promise<void> {
  await db.run('DELETE FROM goal_vehicles_local WHERE user_id = ?', [userId]);
  await db.run('DELETE FROM goals_local WHERE user_id = ?', [userId]);
}

function goalParams(row: GoalLocalRow): SqlValue[] {
  return [
    row.id,
    row.user_id,
    row.name,
    row.goal_type,
    row.target_amount,
    row.target_date,
    row.current_saved,
    row.plan_amount,
    row.plan_cadence,
    row.notes,
    row.deleted_at,
    row.created_at,
    row.updated_at,
  ];
}

function mapGoalRow(row: Record<string, unknown>): GoalLocalRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    goal_type: String(row.goal_type),
    target_amount: Number(row.target_amount),
    target_date: row.target_date == null ? null : String(row.target_date),
    current_saved: Number(row.current_saved ?? 0),
    plan_amount:
      row.plan_amount == null || row.plan_amount === ''
        ? null
        : Number(row.plan_amount),
    plan_cadence:
      row.plan_cadence == null || row.plan_cadence === ''
        ? null
        : String(row.plan_cadence),
    notes: row.notes == null || row.notes === '' ? null : String(row.notes),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
