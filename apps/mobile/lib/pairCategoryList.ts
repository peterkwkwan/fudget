/**
 * Pair Stats category list: the signed-in user's transactions stay
 * itemized; the partner is at most one aggregate row (name + category
 * total). This module never accepts or emits partner transaction rows.
 */
import type { TransactionType } from '@/constants/categories';

import type { Transaction } from './transactionModel';

export const PARTNER_CATEGORY_ROW_ID = 'partner-category-total';

export type PartnerCategoryTotal = {
  sum: number;
  count: number;
};

export type CategoryListEntry =
  | { kind: 'transaction'; transaction: Transaction }
  | {
      kind: 'partner';
      id: typeof PARTNER_CATEGORY_ROW_ID;
      /** Single line: "{Name} · {category} total". */
      label: string;
      sum: number;
      type: TransactionType;
    };

export function partnerDisplayLabel(
  name: string | null | undefined
): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : 'Partner';
}

/** Visible partner-row label. Amount is rendered separately, same list. */
export function partnerCategoryRowLabel(
  partnerName: string | null | undefined,
  category: string
): string {
  return `${partnerDisplayLabel(partnerName)} · ${category} total`;
}

export function parsePartnerCategoryTotal(
  row: { sum?: unknown; count?: unknown } | null | undefined
): PartnerCategoryTotal {
  const sum = Number(row?.sum ?? 0);
  const count = Number(row?.count ?? 0);
  return {
    sum: Number.isFinite(sum) ? sum : 0,
    count: Number.isFinite(count) ? count : 0,
  };
}

/** True when the partner contributed at least one included transaction. */
export function partnerCategoryHasActivity(
  total: PartnerCategoryTotal | null | undefined
): boolean {
  if (!total) return false;
  return total.count > 0 || total.sum !== 0;
}

/**
 * Own rows keep their incoming order (newest first from the ledger).
 * The partner total, when present, is the first row so it stays visible
 * above that breakdown.
 */
export function buildCategoryDrilldownEntries(params: {
  transactions: Transaction[];
  type: TransactionType;
  category: string;
  partnerName?: string | null;
  partnerTotal?: PartnerCategoryTotal | null;
}): CategoryListEntry[] {
  const own: CategoryListEntry[] = params.transactions.map((transaction) => ({
    kind: 'transaction',
    transaction,
  }));

  const partnerTotal = params.partnerTotal;
  if (!partnerTotal || !partnerCategoryHasActivity(partnerTotal)) {
    return own;
  }

  const partner: CategoryListEntry = {
    kind: 'partner',
    id: PARTNER_CATEGORY_ROW_ID,
    label: partnerCategoryRowLabel(params.partnerName, params.category),
    sum: partnerTotal.sum,
    type: params.type,
  };

  return [partner, ...own];
}
