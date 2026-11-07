import type { TransactionType } from '@/constants/categories';
import { lightColors, type ThemeColors } from '@/constants/theme';

/**
 * Income categorical series — greens + blues for clear slice differentiation.
 * Amount token `colors.income` stays brand green/mint for totals text.
 */
export function chartIncomeColorsFor(c: ThemeColors): readonly string[] {
  return [
    c.green[950],
    c.green[700],
    c.blue[700],
    c.blue[500],
    c.green[400],
    c.blue[400],
    c.green[200],
    c.blue[200],
  ];
}

/**
 * Expense categorical series — red, purple, orange, deep yellow (not one rust ramp).
 * Amount token `colors.expense` stays rust/peach for totals text.
 */
export function chartExpenseColorsFor(c: ThemeColors): readonly string[] {
  return [
    c.chartRed[800],
    c.chartPurple[700],
    c.rust[500],
    c.chartAmber[700],
    c.chartRed[500],
    c.chartPurple[400],
    c.rust[400],
    c.chartAmber[500],
  ];
}

/** Light snapshot — prefer `chartIncomeColorsFor(useTheme().colors)`. */
export const CHART_INCOME_COLORS = chartIncomeColorsFor(lightColors);

/** Light snapshot — prefer `chartExpenseColorsFor(useTheme().colors)`. */
export const CHART_EXPENSE_COLORS = chartExpenseColorsFor(lightColors);

/** @deprecated Prefer colorForCategory(index, type, colors). */
export const CHART_CATEGORY_COLORS = CHART_INCOME_COLORS;

export function chartColorsForType(
  type: TransactionType,
  c: ThemeColors = lightColors
): readonly string[] {
  return type === 'income' ? chartIncomeColorsFor(c) : chartExpenseColorsFor(c);
}

export function colorForCategory(
  index: number,
  type: TransactionType = 'expense',
  c: ThemeColors = lightColors
): string {
  const palette = chartColorsForType(type, c);
  return palette[index % palette.length]!;
}

/** Single-series stroke for trend line by metric. */
export function trendStrokeForMetric(
  metric: 'expense' | 'income' | 'net',
  c: ThemeColors = lightColors
): string {
  if (metric === 'income') return c.income;
  if (metric === 'expense') return c.expense;
  // Net: cool brand accent; sign still shown in totals via income/expense tokens.
  return c.green[700];
}
