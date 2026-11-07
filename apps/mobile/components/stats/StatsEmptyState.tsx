import { Pressable, View } from 'react-native';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { fonts, radius, space, typography, type ThemeColors } from '@/constants/theme';
import type { PeriodPreset } from '@/lib/periods';
import { useThemedStyles } from '@/lib/useThemedStyles';

type Props = {
  /** Compact period label from period bounds (e.g. "October", "2026"). */
  periodLabel: string;
  preset: PeriodPreset;
  onAddTransaction?: () => void;
  /**
   * Jump Stats period nav to the current calendar month (Monthly mode).
   * Omit when already on that month — secondary CTA hidden.
   */
  onGoToThisMonth?: () => void;
  /**
   * When false, render Quiet-month chrome only (no CTAs).
   * Prefer omitting handlers on inactive pager slots instead.
   * Default true.
   */
  interactive?: boolean;
};

/** Soft ledger mark — three quiet rows fading out (no emoji). */
function SoftLedgerMark() {
  const styles = useThemedStyles(createStyles);
  const rows = [
    { width: '72%' as const, opacity: 1 },
    { width: '54%' as const, opacity: 0.7 },
    { width: '36%' as const, opacity: 0.4 },
  ];
  return (
    <View style={styles.ledger} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((r, i) => (
        <View
          key={i}
          style={[
            styles.ledgerRow,
            { width: r.width, opacity: r.opacity },
          ]}
        />
      ))}
    </View>
  );
}

function emptyCopy(
  preset: PeriodPreset,
  periodLabel: string
): { title: string; body: string } {
  switch (preset) {
    case 'year':
      return {
        title: 'Quiet year',
        body: `No transactions in ${periodLabel}. Log one, or jump to this month.`,
      };
    case 'custom':
      return {
        title: 'Nothing here',
        body: `No transactions in this period. Log one, or jump to this month.`,
      };
    case 'month':
    default:
      return {
        title: 'Quiet month',
        body: `No transactions in ${periodLabel}. Log one, or jump to a month that already has activity.`,
      };
  }
}

/**
 * Stats empty state C — hide $0 totals; soft ledger mark; Add + optional
 * “Go to this month”. Period chrome stays in the screen header.
 */
export function StatsEmptyState({
  periodLabel,
  preset,
  onAddTransaction,
  onGoToThisMonth,
  interactive = true,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { title, body } = emptyCopy(preset, periodLabel);
  const showActions = interactive && onAddTransaction != null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <SoftLedgerMark />
      <TitleText style={styles.title}>{title}</TitleText>
      <CaptionText style={styles.body}>{body}</CaptionText>
      {showActions ? (
        <Pressable
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.primaryPressed,
          ]}
          onPress={onAddTransaction}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <StrongText style={styles.primaryText}>Add transaction</StrongText>
        </Pressable>
      ) : null}
      {showActions && onGoToThisMonth ? (
        <Pressable
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.secondaryPressed,
          ]}
          onPress={onGoToThisMonth}
          accessibilityRole="button"
          accessibilityLabel="Go to this month"
        >
          <CaptionText style={styles.secondaryText}>Go to this month</CaptionText>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    wrap: {
      flexGrow: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: space.lg + 4,
      paddingVertical: space.xxl,
      gap: space.sm + 6,
    },
    ledger: {
      width: 120,
      padding: space.md,
      borderRadius: radius.lg - 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      gap: 10,
      marginBottom: space.xs,
    },
    ledgerRow: {
      height: 8,
      borderRadius: radius.sm / 2,
      backgroundColor: colors.border,
    },
    title: {
      color: colors.green[950],
      textAlign: 'center' as const,
      fontSize: 20,
      lineHeight: 26,
    },
    body: {
      color: colors.inkMuted,
      textAlign: 'center' as const,
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 270,
    },
    primary: {
      marginTop: space.sm + 2,
      minWidth: 200,
      height: 44,
      paddingHorizontal: space.lg - 4,
      borderRadius: radius.md,
      backgroundColor: colors.green[700],
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    primaryPressed: {
      backgroundColor: colors.primaryPressed,
    },
    primaryText: {
      color: colors.inkInverse,
      fontFamily: fonts.bodyStrong,
      fontSize: 16,
    },
    secondary: {
      minWidth: 200,
      height: 40,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.canvas,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    secondaryPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    secondaryText: {
      color: colors.green[700],
      fontFamily: fonts.bodyStrong,
      fontSize: 14,
    },
  };
}
