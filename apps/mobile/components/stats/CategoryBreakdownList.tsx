import { Pressable, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colorForCategory } from '@/constants/chartColors';
import { fonts, space, typography, type ThemeColors } from '@/constants/theme';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { useTheme } from '@/lib/ThemeProvider';
import type { CategoryTotal } from '@/lib/stats';
import { useThemedStyles } from '@/lib/useThemedStyles';

type Props = {
  data: CategoryTotal[];
  /** When omitted, rows are display-only (e.g. pair aggregates — no txn drill-down). */
  onSelect?: (row: CategoryTotal) => void;
  /** Active Stats type — drives income vs expense chart swatches. */
  type: TransactionType;
};

export function CategoryBreakdownList({ data, onSelect, type }: Props) {
  const { formatWhole } = useFormatMoney();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (data.length === 0) {
    return null;
  }

  const total = data.reduce((acc, row) => acc + row.sum, 0) || 1;
  const selectable = typeof onSelect === 'function';
  const amountColor = type === 'expense' ? colors.expense : colors.income;
  /** Income: bold the dominant source (RPC orders by sum desc). */
  const emphasizeDominant = type === 'income';

  return (
    <View style={styles.list}>
      {data.map((row, index) => {
        const pct = Math.round((row.sum / total) * 100);
        const emphasis = emphasizeDominant && index === 0;
        const amountLabel = formatWhole(row.sum);
        const label = `${row.category}, ${pct} percent, ${amountLabel}${
          selectable ? '. Open transactions.' : '.'
        }`;
        const body = (
          <>
            <View style={styles.top}>
              <StrongText
                style={[styles.category, emphasis && styles.categoryEmphasis]}
                numberOfLines={1}
              >
                {row.category}
              </StrongText>
              <CaptionText style={styles.amount}>{amountLabel}</CaptionText>
            </View>
            <View style={styles.shareRow}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, Math.max(0, pct))}%`,
                      backgroundColor: colorForCategory(index, type, colors),
                    },
                  ]}
                />
              </View>
              <StrongText style={[styles.pct, { color: amountColor }]}>
                {pct}%
              </StrongText>
            </View>
          </>
        );

        if (!selectable) {
          return (
            <View
              key={row.category}
              style={styles.row}
              accessibilityLabel={label}
            >
              {body}
            </View>
          );
        }

        return (
          <Pressable
            key={row.category}
            onPress={() => onSelect(row)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    list: {
      gap: 0,
    },
    row: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    pressed: {
      backgroundColor: colors.surfaceMuted,
    },
    top: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: space.sm,
    },
    category: {
      flex: 1,
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fonts.caption,
    },
    categoryEmphasis: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: fonts.bodyStrong,
    },
    shareRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    pct: {
      ...typography.amount,
      fontSize: 11,
      lineHeight: 14,
      width: 36,
      textAlign: 'right' as const,
    },
    amount: {
      color: colors.inkMuted,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ['tabular-nums'] as const,
    },
    track: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.canvas,
      overflow: 'hidden' as const,
    },
    fill: {
      height: '100%' as const,
      borderRadius: 3,
    },
  };
}
