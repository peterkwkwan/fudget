/**
 * Shared Planner-account balance math for linked transactions.
 * Income adds; expense subtracts. Transfer: From −amount, To +amount.
 * Balance never goes below zero. Used by online writes and the offline SQLite path.
 */
import type { TransactionType } from '@/constants/categories';

export type LinkedTxnEffect = {
  vehicle_id: string | null | undefined;
  /** To account for type=transfer; ignored for expense/income. */
  transfer_to_vehicle_id?: string | null | undefined;
  type: TransactionType;
  amount: number;
};

export type BalanceDelta = {
  vehicle_id: string;
  /** Signed change: positive adds to balance, negative subtracts. */
  delta: number;
};

export type BalanceSnapshot = {
  vehicle_id: string;
  balance: number;
};

/**
 * Per-account signed deltas for one txn effect.
 * Unlinked expense/income → []. Transfer without both legs → [].
 */
export function linkedTxnBalanceDeltas(effect: LinkedTxnEffect): BalanceDelta[] {
  if (!(effect.amount > 0) || Number.isNaN(effect.amount)) return [];

  if (effect.type === 'transfer') {
    const fromId = effect.vehicle_id?.trim() || null;
    const toId = effect.transfer_to_vehicle_id?.trim() || null;
    if (!fromId || !toId || fromId === toId) return [];
    return [
      { vehicle_id: fromId, delta: -effect.amount },
      { vehicle_id: toId, delta: effect.amount },
    ];
  }

  if (!effect.vehicle_id) return [];
  const signed = effect.type === 'income' ? effect.amount : -effect.amount;
  return [{ vehicle_id: effect.vehicle_id, delta: signed }];
}

/**
 * Signed effect of one linked expense/income on its account.
 * Transfers return 0 — use linkedTxnBalanceDeltas for both legs.
 * @deprecated Prefer linkedTxnBalanceDeltas for new code.
 */
export function linkedTxnSignedDelta(effect: LinkedTxnEffect): number {
  if (effect.type === 'transfer') return 0;
  if (!effect.vehicle_id) return 0;
  if (!(effect.amount > 0) || Number.isNaN(effect.amount)) return 0;
  return effect.type === 'income' ? effect.amount : -effect.amount;
}

/** Round money to 2 decimals (match numeric(14,2) / app amounts). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Apply a signed delta; clamp at zero (DB check balance >= 0). */
export function applyBalanceDelta(current: number, delta: number): number {
  return roundMoney(Math.max(0, current + delta));
}

/**
 * Net balance adjustments when replacing `prev` with `next` (or deleting → next null).
 * Reverse the prior linked effect, then apply the new one. Same vehicle nets.
 */
export function balanceDeltasForTxnChange(
  prev: LinkedTxnEffect | null | undefined,
  next: LinkedTxnEffect | null | undefined
): BalanceDelta[] {
  const byId = new Map<string, number>();

  function add(effect: LinkedTxnEffect | null | undefined, sign: 1 | -1) {
    if (!effect) return;
    for (const { vehicle_id, delta } of linkedTxnBalanceDeltas(effect)) {
      byId.set(vehicle_id, roundMoney((byId.get(vehicle_id) ?? 0) + sign * delta));
    }
  }

  // Reverse prior, then apply next.
  add(prev, -1);
  add(next, 1);

  const out: BalanceDelta[] = [];
  for (const [vehicle_id, delta] of byId) {
    if (delta !== 0) out.push({ vehicle_id, delta });
  }
  return out;
}

/** Fold deltas onto a balance map; returns new absolute balances for affected ids. */
export function snapshotsAfterDeltas(
  balances: ReadonlyMap<string, number>,
  deltas: readonly BalanceDelta[]
): BalanceSnapshot[] {
  return deltas.map(({ vehicle_id, delta }) => ({
    vehicle_id,
    balance: applyBalanceDelta(balances.get(vehicle_id) ?? 0, delta),
  }));
}
