import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/constants/theme';
import type { TransactionType } from '@/constants/categories';

type Props = {
  category: string;
  type: TransactionType;
  size?: number;
};

/**
 * Soft tinted tile for transaction rows (Figma category icon slot).
 * Uses a letter glyph — Metro-safe stand-in for Lucide category icons.
 */
export function CategoryIconTile({ category, type, size = 34 }: Props) {
  const income = type === 'income';
  const transfer = type === 'transfer';
  const bg = transfer
    ? colors.surfaceMuted
    : income
      ? colors.incomeTint
      : colors.expenseTint;
  const fg = transfer
    ? colors.inkMuted
    : income
      ? colors.green[700]
      : colors.expense;
  const letter = (category.trim().charAt(0) || '?').toUpperCase();
  const height = Math.round(size * (36 / 34));

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height,
          backgroundColor: bg,
          borderRadius: radius.tile,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.letter, { color: fg, fontSize: size * 0.42 }]}>
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontFamily: fonts.bodyStrong,
    lineHeight: undefined,
  },
});
