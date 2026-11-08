import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { UsersIcon } from '@/components/icons';
import { CaptionText, StrongText } from '@/components/StyledText';
import { fonts, radius, space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useThemedStyles } from '@/lib/useThemedStyles';

type Props = {
  /** e.g. "Alex's accounts" */
  title: string;
  /** Active partner item count. */
  total: number;
  /** Expanded read-only list (sibling cards below the aggregate). */
  children: ReactNode;
};

/**
 * Pair-mode partner block: aggregate card matches own Planner account cards
 * (surface, radius.lg, icon tile + copy + trailing control). Expands to a
 * read-only list rendered as sibling items — not nested muted rows.
 */
export function PartnerCollapsibleCard({ title, total, children }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = useThemedStyles(createStyles);
  const countLabel = `${total} total`;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${countLabel}`}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.symbol}>
            <UsersIcon color={colors.green[700]} size={19} />
          </View>
          <View style={styles.copy}>
            <StrongText style={styles.title} numberOfLines={2}>
              {title}
            </StrongText>
            <CaptionText style={styles.meta}>
              {countLabel}
              {open ? '' : ' · Click to see details.'}
            </CaptionText>
          </View>
          <CaptionText style={styles.chevron}>{open ? '▾' : '▸'}</CaptionText>
        </View>
      </Pressable>
      {open ? <View style={styles.list}>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    wrap: {
      gap: space.sm,
      marginBottom: 2,
    },
    card: {
      borderRadius: radius.lg,
      padding: space.md,
      backgroundColor: colors.surface,
      gap: 14,
    },
    cardPressed: {
      backgroundColor: colors.green[50],
    },
    cardTop: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    symbol: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.green[50],
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      color: colors.ink,
      fontSize: 15,
    },
    meta: {
      color: colors.inkMuted,
      fontSize: 11,
    },
    chevron: {
      color: colors.green[700],
      fontFamily: fonts.bodyStrong,
      fontSize: 16,
      paddingLeft: space.sm,
    },
    list: {
      gap: space.sm,
    },
  };
}
