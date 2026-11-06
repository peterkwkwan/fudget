import type { TransactionType } from '@/constants/categories';
import { colors } from '@/constants/theme';

/**
 * Income categorical series — greens + blues for clear slice differentiation.
 * Amount token `colors.income` stays brand green for totals text.
 */
export const CHART_INCOME_COLORS = [
  colors.green[950],
  colors.green[700],
  colors.blue[700],
  colors.blue[500],
  colors.green[400],
  colors.blue[400],
  colors.green[200],
  colors.blue[200],
] as const;

/**
 * Expense categorical series — red, purple, orange, deep yellow (not one rust ramp).
 * Amount token `colors.expense` stays rust for totals text.
 */
export const CHART_EXPENSE_COLORS = [
  colors.chartRed[800],
  colors.chartPurple[700],
  colors.rust[500],
  colors.chartAmber[700],
  colors.chartRed[500],
  colors.chartPurple[400],
  colors.rust[400],
  colors.chartAmber[500],
] as const;

/** @deprecated Prefer colorForCategory(index, type). */
export const CHART_CATEGORY_COLORS = CHART_INCOME_COLORS;

export function chartColorsForType(
  type: TransactionType
): readonly string[] {
  return type === 'income' ? CHART_INCOME_COLORS : CHART_EXPENSE_COLORS;
}

export function colorForCategory(
  index: number,
  type: TransactionType = 'expense'
): string {
  const palette = chartColorsForType(type);
  return palette[index % palette.length]!;
}

/** Single-series stroke for trend line by metric. */
export function trendStrokeForMetric(
  metric: 'expense' | 'income' | 'net'
): string {
  if (metric === 'income') return colors.income;
  if (metric === 'expense') return colors.expense;
  // Net: cool brand accent; sign still shown in totals via income/expense tokens.
  return colors.green[700];
}
