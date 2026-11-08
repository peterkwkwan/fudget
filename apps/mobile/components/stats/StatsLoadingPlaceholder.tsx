import { View } from 'react-native';

import { CategoryListSkeleton } from '@/components/stats/CategoryListSkeleton';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { StatsQuietPeers } from '@/components/stats/StatsQuietPeers';
import {
  PIE_TYPE_OPTIONS,
  StatsSegmentToggle,
} from '@/components/stats/StatsSegmentToggle';
import { CaptionText, StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { fonts, radius, space, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/lib/useThemedStyles';

const QUIET_PEER_LABELS = [
  { label: 'Spent', value: '' },
  { label: 'Earned', value: '' },
  { label: 'Net', value: '' },
] as const;

type Props = {
  pieType: TransactionType;
};

/**
 * Themed Stats shell while this period has nothing cached yet.
 * Same card, donut height, and peer row as a loaded month so fill does not jump.
 */
export function StatsLoadingPlaceholder({ pieType }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading statistics"
    >
      <View style={styles.cardSection}>
        <StrongText style={styles.sectionTitle}>By category</StrongText>
        <StatsSegmentToggle
          options={PIE_TYPE_OPTIONS}
          value={pieType}
          readOnly
          accessibilityLabel="Category type"
        />
      </View>
      <View style={styles.section}>
        <CategoryPieChart
          data={[]}
          type={pieType}
          centerTotal={0}
          loading
          emptyLabel=""
        />
        <CaptionText style={styles.savingsRate}>Savings rate n/a</CaptionText>
        <StatsQuietPeers peers={QUIET_PEER_LABELS} placeholder />
        <CategoryListSkeleton />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.md,
      gap: space.md,
    },
    cardSection: {
      gap: space.md,
    },
    section: {
      gap: space.sm,
    },
    sectionTitle: {
      color: colors.ink,
      ...typography.section,
      textAlign: 'left' as const,
    },
    savingsRate: {
      color: colors.inkMuted,
      textAlign: 'center' as const,
      fontSize: 12,
      lineHeight: 16,
      backgroundColor: colors.expenseTint,
      overflow: 'hidden' as const,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'center' as const,
      fontFamily: fonts.caption,
    },
  };
}
