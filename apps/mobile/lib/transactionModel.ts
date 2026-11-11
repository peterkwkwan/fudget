/**
 * Pure transaction shapes, validation, and list visibility.
 * Shared by the Supabase adapter and the offline repository.
 * No network and no SQLite.
 */
import {
  TRANSFER_CATEGORY,
  type TransactionType,
} from '@/constants/categories';
import {
  formatDisplayDate,
  isOnOrBeforeLocalToday,
  localDateKey,
  zonedYmd,
} from '@/lib/dates';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  type PeriodFocus,
} from '@/lib/periods';

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  note: string | null;
  currency: string;
  occurred_at: string;
  recurring_series_id: string | null;
  occurrence_key: string | null;
  /**
   * Planner account: optional link for expense/income; From for transfer.
   */
  vehicle_id: string | null;
  /** To account for type=transfer; null otherwise. */
  transfer_to_vehicle_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionInput = {
  amount: number;
  type: TransactionType;
  category: string;
  note?: string | null;
  occurred_at: string;
  /** Optional Planner account; From for transfer. */
  vehicle_id?: string | null;
  /** To account for transfer; omit/null for expense/income. */
  transfer_to_vehicle_id?: string | null;
};

export type TransactionBulkPatch = {
  occurred_at?: string;
  category?: string;
  note?: string | null;
};

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateTransactionInput(input: TransactionInput): string | null {
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    return 'Amount must be greater than zero.';
  }
  if (
    input.type !== 'expense' &&
    input.type !== 'income' &&
    input.type !== 'transfer'
  ) {
    return 'Type must be expense, income, or transfer.';
  }

  const note = input.note?.trim() ?? '';
  if (note.length > 500) {
    return 'Note must be 500 characters or fewer.';
  }
  if (!input.occurred_at) {
    return 'Date is required.';
  }

  if (input.type === 'transfer') {
    const fromId = normalizeOptionalId(input.vehicle_id);
    const toId = normalizeOptionalId(input.transfer_to_vehicle_id);
    if (!fromId || !toId) {
      return 'Pick From and To accounts.';
    }
    if (fromId === toId) {
      return 'From and To must be different accounts.';
    }
    return null;
  }

  const category = input.category?.trim() ?? '';
  if (!category || category.length > 40) {
    return 'Pick a category.';
  }
  return null;
}

/**
 * Normalize transfer fields before insert/update.
 * Forces category Transfer and clears To for non-transfers.
 */
export function normalizeTransactionInput(
  input: TransactionInput
): TransactionInput {
  if (input.type === 'transfer') {
    return {
      ...input,
      category: TRANSFER_CATEGORY,
      vehicle_id: normalizeOptionalId(input.vehicle_id),
      transfer_to_vehicle_id: normalizeOptionalId(input.transfer_to_vehicle_id),
    };
  }
  return {
    ...input,
    vehicle_id: normalizeOptionalId(input.vehicle_id),
    transfer_to_vehicle_id: null,
  };
}

/**
 * Field snapshot for one bulk-edit row. Category is trimmed the same way
 * the remote bulk patch always saved it.
 */
export function inputFromBulkPatch(
  row: Transaction,
  patch: TransactionBulkPatch
): TransactionInput {
  const category = (patch.category ?? row.category).trim();
  if (patch.category !== undefined && !category) {
    throw new Error('Pick a category.');
  }
  return {
    amount: row.amount,
    type: row.type,
    category,
    note: patch.note !== undefined ? patch.note : row.note,
    occurred_at: patch.occurred_at ?? row.occurred_at,
    vehicle_id: row.vehicle_id,
    transfer_to_vehicle_id: row.transfer_to_vehicle_id,
  };
}

/** `year-month` key matching {@link PeriodFocus} (month is 1–12, not padded). */
export function localMonthFocusKey(
  isoOrDate: string | Date,
  timeZone: string
): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const { year, month } = zonedYmd(d, timeZone);
  return `${year}-${month}`;
}

export function periodFocusMonthKey(focus: PeriodFocus): string {
  return `${focus.year}-${focus.month}`;
}

/**
 * Bucket active rows by local calendar month once so month swipe can look up
 * a bucket instead of scanning the full history on every focus change.
 */
export function indexTransactionsByLocalMonth(
  rows: Transaction[],
  timeZone: string
): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of rows) {
    const key = localMonthFocusKey(t.occurred_at, timeZone);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(t);
    else map.set(key, [t]);
  }
  return map;
}

/**
 * Transactions list: one-offs always; recurring only when local calendar date <= today.
 * Future generated instances stay in DB (90d horizon) but are hidden here.
 */
export function filterTransactionsVisible(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date()
): Transaction[] {
  return rows.filter((t) => {
    if (!t.recurring_series_id) return true;
    return isOnOrBeforeLocalToday(t.occurred_at, timeZone, now);
  });
}

/**
 * Visible rows whose occurred_at falls in the focused calendar month.
 * Prefer {@link indexTransactionsByLocalMonth} + {@link filterIndexedMonth}
 * when the same full list is filtered for many months (swipe).
 */
export function filterTransactionsForMonth(
  rows: Transaction[],
  timeZone: string,
  focus: PeriodFocus,
  now: Date = new Date()
): Transaction[] {
  const bounds = resolvePeriodBounds('month', timeZone, { focus, now });
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  return filterTransactionsVisible(rows, timeZone, now).filter((t) => {
    const occurred = new Date(t.occurred_at);
    if (Number.isNaN(occurred.getTime())) return false;
    const ms = occurred.getTime();
    return ms >= startMs && ms < endMs;
  });
}

/**
 * Visible rows for one focus from a pre-built local-month index.
 * Avoids a full-list scan on each month change after the index is warm.
 */
export function filterIndexedMonth(
  index: Map<string, Transaction[]>,
  timeZone: string,
  focus: PeriodFocus,
  now: Date = new Date()
): Transaction[] {
  const bucket = index.get(periodFocusMonthKey(focus)) ?? [];
  return filterTransactionsVisible(bucket, timeZone, now);
}

export type UpcomingRepeatsSummary = {
  items: Transaction[];
  count: number;
  expenseSum: number;
  incomeSum: number;
  /** Short label list, e.g. "Rent and Bills, Salary". */
  namesLabel: string;
  /** Date span in local TZ, e.g. "Oct 24 – Oct 31". */
  datesLabel: string;
};

/**
 * Focused-month recurring instances with local date after today (still generated).
 * Defaults to the current calendar month when `focus` is omitted.
 */
export function summarizeUpcomingRepeatsThisMonth(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date(),
  focus: PeriodFocus = currentPeriodFocus(timeZone, now)
): UpcomingRepeatsSummary | null {
  const bounds = resolvePeriodBounds('month', timeZone, { focus, now });
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const todayKey = localDateKey(now, timeZone);

  const items = rows
    .filter((t) => {
      if (!t.recurring_series_id) return false;
      const occurred = new Date(t.occurred_at);
      if (Number.isNaN(occurred.getTime())) return false;
      const ms = occurred.getTime();
      if (ms < startMs || ms >= endMs) return false;
      const key = localDateKey(t.occurred_at, timeZone);
      return Boolean(key && todayKey && key > todayKey);
    })
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

  if (items.length === 0) return null;

  let expenseSum = 0;
  let incomeSum = 0;
  const nameOrder: string[] = [];
  const seen = new Set<string>();
  for (const t of items) {
    if (t.type === 'expense') expenseSum += t.amount;
    else if (t.type === 'income') incomeSum += t.amount;
    if (!seen.has(t.category)) {
      seen.add(t.category);
      nameOrder.push(t.category);
    }
  }

  const namesLabel =
    nameOrder.length <= 2
      ? nameOrder.join(', ')
      : `${nameOrder.slice(0, 2).join(', ')} +${nameOrder.length - 2}`;

  const first = items[0].occurred_at;
  const last = items[items.length - 1].occurred_at;
  const firstLabel = formatDisplayDate(first, timeZone);
  const lastLabel = formatDisplayDate(last, timeZone);
  const datesLabel =
    firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;

  return {
    items,
    count: items.length,
    expenseSum,
    incomeSum,
    namesLabel,
    datesLabel,
  };
}
