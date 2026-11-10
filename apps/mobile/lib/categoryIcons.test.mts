import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORY,
} from '../constants/categories.ts';
import {
  CATEGORY_ICON_NAMES,
  categoryIconName,
  categoryLetter,
} from './categoryIcons.ts';

const builtins = [
  ...EXPENSE_CATEGORIES.map((name) => ({ type: 'expense' as const, name })),
  ...INCOME_CATEGORIES.map((name) => ({ type: 'income' as const, name })),
  { type: 'transfer' as const, name: TRANSFER_CATEGORY },
];

test('every built-in category has a distinct icon', () => {
  const icons = builtins.map(({ type, name }) => {
    const icon = categoryIconName(type, name);
    assert.ok(icon, `${name} is missing an icon`);
    assert.equal(icon, CATEGORY_ICON_NAMES[name]);
    return icon;
  });
  assert.equal(new Set(icons).size, icons.length);
});

test('custom categories stay a letter', () => {
  assert.equal(categoryIconName('expense', 'Business Expense'), null);
  assert.equal(categoryLetter('Business Expense'), 'B');
  assert.equal(categoryLetter('  snacks '), 'S');
  assert.equal(categoryLetter('   '), '?');
  assert.equal(categoryLetter(''), '?');
});

test('a custom name that matches another type stays a letter', () => {
  assert.equal(categoryIconName('income', 'Groceries'), null);
  assert.equal(categoryLetter('Groceries'), 'G');
  assert.equal(categoryIconName('expense', 'Groceries'), 'shopping-basket');
});

test('Figma transaction glyphs stay pinned', () => {
  assert.equal(categoryIconName('income', 'Salary'), 'briefcase-business');
  assert.equal(categoryIconName('expense', 'Transport'), 'bus-front');
  assert.equal(categoryIconName('expense', 'Kids'), 'baby');
  assert.equal(categoryIconName('expense', 'Eating out'), 'utensils');
  assert.equal(categoryIconName('expense', 'Groceries'), 'shopping-basket');
});
