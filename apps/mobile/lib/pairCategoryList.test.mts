/**
 * Pair category drill-down: own rows stay itemized; partner is one label.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from './transactionModel.ts';
import {
  PARTNER_CATEGORY_ROW_ID,
  buildCategoryDrilldownEntries,
  parsePartnerCategoryTotal,
  partnerCategoryRowLabel,
} from './pairCategoryList.ts';

function txn(
  partial: Partial<Transaction> &
    Pick<Transaction, 'id' | 'amount' | 'category' | 'occurred_at'>
): Transaction {
  return {
    user_id: 'user-self',
    type: 'expense',
    note: partial.note ?? 'lunch',
    currency: 'HKD',
    recurring_series_id: null,
    occurrence_key: null,
    vehicle_id: null,
    transfer_to_vehicle_id: null,
    deleted_at: null,
    created_at: partial.occurred_at,
    updated_at: partial.occurred_at,
    ...partial,
  };
}

describe('partnerCategoryRowLabel', () => {
  it('labels the row as partner name, category, and total', () => {
    assert.equal(
      partnerCategoryRowLabel('Alex', 'Groceries'),
      'Alex · Groceries total'
    );
  });

  it('falls back when the partner has no display name', () => {
    assert.equal(
      partnerCategoryRowLabel('  ', 'Rent'),
      'Partner · Rent total'
    );
    assert.equal(
      partnerCategoryRowLabel(null, 'Salary'),
      'Partner · Salary total'
    );
  });
});

describe('parsePartnerCategoryTotal', () => {
  it('coerces numeric strings and blanks', () => {
    assert.deepEqual(
      parsePartnerCategoryTotal({ sum: '40.5', count: '2' }),
      { sum: 40.5, count: 2 }
    );
    assert.deepEqual(parsePartnerCategoryTotal(undefined), {
      sum: 0,
      count: 0,
    });
  });
});

describe('buildCategoryDrilldownEntries', () => {
  const older = txn({
    id: 'own-old',
    amount: 12,
    category: 'Groceries',
    occurred_at: '2026-11-01T00:00:00.000Z',
  });
  const newer = txn({
    id: 'own-new',
    amount: 8,
    category: 'Groceries',
    occurred_at: '2026-11-03T00:00:00.000Z',
    note: 'market',
  });

  it('keeps the personal breakdown and order when the partner has nothing', () => {
    const entries = buildCategoryDrilldownEntries({
      transactions: [newer, older],
      type: 'expense',
      category: 'Groceries',
      partnerName: 'Alex',
      partnerTotal: { sum: 0, count: 0 },
    });
    assert.deepEqual(
      entries.map((entry) =>
        entry.kind === 'transaction' ? entry.transaction.id : entry.kind
      ),
      ['own-new', 'own-old']
    );
  });

  it('puts one partner total ahead of the same itemized rows', () => {
    const entries = buildCategoryDrilldownEntries({
      transactions: [newer, older],
      type: 'expense',
      category: 'Groceries',
      partnerName: '  Alex  ',
      partnerTotal: { sum: 40, count: 3 },
    });
    assert.equal(entries[0]?.kind, 'partner');
    if (entries[0]?.kind !== 'partner') return;
    assert.equal(entries[0].id, PARTNER_CATEGORY_ROW_ID);
    assert.equal(entries[0].label, 'Alex · Groceries total');
    assert.equal(entries[0].sum, 40);
    assert.equal(entries[0].type, 'expense');
    assert.deepEqual(Object.keys(entries[0]).sort(), [
      'id',
      'kind',
      'label',
      'sum',
      'type',
    ]);
    assert.deepEqual(
      entries.slice(1).map((entry) =>
        entry.kind === 'transaction' ? entry.transaction.id : entry.id
      ),
      ['own-new', 'own-old']
    );
    const own = entries[1];
    if (own?.kind === 'transaction') {
      assert.equal(own.transaction.note, 'market');
    }
  });

  it('can be only the partner line when you have no rows in the category', () => {
    const entries = buildCategoryDrilldownEntries({
      transactions: [],
      type: 'income',
      category: 'Salary',
      partnerName: null,
      partnerTotal: { sum: 1000, count: 1 },
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.kind, 'partner');
    if (entries[0]?.kind === 'partner') {
      assert.equal(entries[0].label, 'Partner · Salary total');
    }
  });
});
