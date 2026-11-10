import { StyleSheet, View } from 'react-native';

import { CategoryGlyph } from '@/components/CategoryGlyph';
import { radius } from '@/constants/theme';
import type { TransactionType } from '@/constants/categories';
import { useTheme } from '@/lib/ThemeProvider';

type Props = {
  category: string;
  type: TransactionType;
  size?: number;
  /** Keep a letter even when the string matches a built-in category (partner initial). */
  letterOnly?: boolean;
};

/**
 * Soft tinted tile for transaction rows (Figma category icon slot).
 * Built-in categories use a Lucide glyph; custom names stay a letter.
 */
export function CategoryIconTile({
  category,
  type,
  size = 34,
  letterOnly = false,
}: Props) {
  const { colors } = useTheme();
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
  const height = Math.round(size * (36 / 34));
  const iconSize = Math.round(size * (17 / 34));

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
      <CategoryGlyph
        category={category}
        type={type}
        color={fg}
        iconSize={iconSize}
        letterFontSize={size * 0.42}
        letterOnly={letterOnly}
        letterStyle={styles.letter}
      />
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
    lineHeight: undefined,
  },
});
