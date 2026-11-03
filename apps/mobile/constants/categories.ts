/** Fixed system category lists — customs layer on top via user_categories. */

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Social Life',
  'Pets',
  'Transport',
  'Household',
  'Apparel',
  'Beauty',
  'Health',
  'Education',
  'Gift',
  'Other',
  'Kids',
  'Gaming',
  'Rent and Bills',
  'Eating out',
  'Vacation',
  'Donation',
] as const;

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Other income'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type TransactionCategory = ExpenseCategory | IncomeCategory;
export type TransactionType = 'expense' | 'income' | 'transfer';

/** Sentinel category stored for type=transfer (no picker). */
export const TRANSFER_CATEGORY = 'Transfer';

export function categoriesForType(type: TransactionType): readonly string[] {
  if (type === 'transfer') return [TRANSFER_CATEGORY];
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function isSystemCategory(type: TransactionType, category: string): boolean {
  if (type === 'transfer') return category === TRANSFER_CATEGORY;
  return (categoriesForType(type) as readonly string[]).includes(category);
}

/** System-only check (legacy name). Prefer isAllowedCategory with customs. */
export function isValidCategory(type: TransactionType, category: string): boolean {
  return isSystemCategory(type, category);
}

export function defaultCategory(type: TransactionType): string {
  if (type === 'transfer') return TRANSFER_CATEGORY;
  return type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
}
