import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORY,
  isSystemCategory,
  type TransactionType,
} from '@/constants/categories';

type SystemCategoryName =
  | (typeof EXPENSE_CATEGORIES)[number]
  | (typeof INCOME_CATEGORIES)[number]
  | typeof TRANSFER_CATEGORY;

/**
 * Lucide icon ids for built-in categories.
 * Names that appear on the Figma transaction rows use that frame's glyph.
 */
export const CATEGORY_ICON_NAMES = {
  Groceries: 'shopping-basket',
  'Social Life': 'users',
  Pets: 'paw-print',
  Transport: 'bus-front',
  Household: 'house',
  Apparel: 'shirt',
  Beauty: 'sparkles',
  Health: 'heart-pulse',
  Education: 'graduation-cap',
  Gift: 'gift',
  Other: 'shapes',
  Kids: 'baby',
  Gaming: 'gamepad-2',
  'Rent and Bills': 'receipt',
  'Eating out': 'utensils',
  Vacation: 'plane',
  Donation: 'hand-heart',
  Salary: 'briefcase-business',
  Freelance: 'laptop',
  'Other income': 'coins',
  [TRANSFER_CATEGORY]: 'arrow-left-right',
} as const satisfies Record<SystemCategoryName, string>;

export type CategoryIconName =
  (typeof CATEGORY_ICON_NAMES)[keyof typeof CATEGORY_ICON_NAMES];

/** Icon for a built-in category. Custom names (and the partner initial) return null. */
export function categoryIconName(
  type: TransactionType,
  category: string
): CategoryIconName | null {
  const name = category.trim();
  if (!isSystemCategory(type, name)) return null;
  const icon =
    CATEGORY_ICON_NAMES[name as keyof typeof CATEGORY_ICON_NAMES];
  return icon ?? null;
}

/** First letter of a custom category name. Empty names use "?". */
export function categoryLetter(category: string): string {
  return (category.trim().charAt(0) || '?').toUpperCase();
}
