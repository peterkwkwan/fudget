import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterIndexedMonth,
  filterTransactionsForMonth,
  indexTransactionsByLocalMonth,
  periodFocusMonthKey,
  type Transaction,
} from './transactionModel.ts';

function row(
  partial: Partial<Transaction> & Pick<Transaction, 'id' | 'occurred_at'>
): Transaction {
  return {
    user_id: 'u1',
    amount: 10,
    type: 'expense',
    category: 'Food',
    note: null,
    currency: 'HKD',
    recurring_series_id: null,
    occurrence_key: null,
    vehicle_id: null,
    transfer_to_vehicle_id: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

test('month index lookup matches full-list filter for the focused month', () => {
  const timeZone = 'UTC';
  const focus = { year: 2026, month: 3 };
  const rows = [
    row({ id: 'a', occurred_at: '2026-02-15T12:00:00.000Z' }),
    row({ id: 'b', occurred_at: '2026-03-01T00:00:00.000Z' }),
    row({ id: 'c', occurred_at: '2026-03-20T15:30:00.000Z' }),
    row({ id: 'd', occurred_at: '2026-04-01T00:00:00.000Z' }),
  ];

  const index = indexTransactionsByLocalMonth(rows, timeZone);
  assert.equal(index.get(periodFocusMonthKey(focus))?.length, 2);

  const fromIndex = filterIndexedMonth(index, timeZone, focus);
  const fromScan = filterTransactionsForMonth(rows, timeZone, focus);
  assert.deepEqual(
    fromIndex.map((t) => t.id).sort(),
    fromScan.map((t) => t.id).sort()
  );
});
