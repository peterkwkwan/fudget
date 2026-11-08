import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryIconTile } from '@/components/CategoryIconTile';
import { StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { space, typography, type ThemeColors } from '@/constants/theme';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import {
  partnerCategoryRowLabel,
  partnerDisplayLabel,
} from '@/lib/pairCategoryList';
import { useTheme } from '@/lib/ThemeProvider';

type Props = {
  partnerName: string | null | undefined;
  category: string;
  amount: number;
  type: TransactionType;
  hideSeparator?: boolean;
};

/**
 * One non-interactive line for the partner's category total.
 * Same row chrome as a transaction (light and dark tokens) but no date,
 * note, or navigation — there is no partner transaction to open.
 */
export function PartnerCategoryTotalRow({
  partnerName,
  category,
  amount,
  type,
  hideSeparator = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { format } = useFormatMoney();
  const label = partnerCategoryRowLabel(partnerName, category);
  const sign = type === 'expense' ? '−' : '+';
  const amountLabel = `${sign}${format(Math.abs(amount))}`;
  const amountColor = type === 'income' ? colors.income : colors.expense;

  return (
    <View
      style={[styles.row, hideSeparator && styles.rowNoSeparator]}
      accessibilityRole="text"
      accessibilityLabel={`${label}, ${amountLabel}`}
    >
      <CategoryIconTile
        category={partnerDisplayLabel(partnerName)}
        type={type === 'income' ? 'income' : 'expense'}
      />
      <StrongText style={styles.label} numberOfLines={1}>
        {label}
      </StrongText>
      <StrongText style={[styles.amount, { color: amountColor }]}>
        {amountLabel}
      </StrongText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      minHeight: 69,
      paddingVertical: space.sm + 4,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowNoSeparator: {
      borderBottomWidth: 0,
    },
    label: {
      flex: 1,
      color: colors.ink,
      fontSize: 13,
      lineHeight: 18,
    },
    amount: {
      ...typography.amount,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: -0.3,
    },
  });
}
