import { StyleSheet, View } from 'react-native';

import { CalendarIcon } from '@/components/icons';
import { CaptionText, TitleText } from '@/components/StyledText';
import { colors, radius, space, typography } from '@/constants/theme';

type Props = {
  /** Period nav label, e.g. "December". */
  periodLabel: string;
};

/**
 * Full empty-month screen for Transactions (any pager slot).
 * Figma: calendar glyph + title + supporting copy (FAB remains primary add).
 */
export function TransactionsEmptyMonth({ periodLabel }: Props) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <View style={styles.iconWell}>
        <CalendarIcon color={colors.green[700]} size={28} />
      </View>
      <TitleText style={styles.emptyTitle}>
        No transactions in {periodLabel}
      </TitleText>
      <CaptionText style={styles.emptyBody}>
        Tap + to add an expense or income. On the Add screen you can type it, or
        tap the mic to speak a draft before saving.
      </CaptionText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: {
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
