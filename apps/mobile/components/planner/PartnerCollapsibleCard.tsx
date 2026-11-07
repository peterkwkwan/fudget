import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { fonts, radius, space, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/lib/useThemedStyles';

type Props = {
  /** e.g. "Alex's accounts" */
  title: string;
  /** Active partner item count. */
  total: number;
  children: ReactNode;
};

/**
 * Pair-mode partner block: same outer card as a normal Planner card;
 * expands to a read-only list. Collapsed subtitle: “Click to see details.”
 *
 * Uses `surface` (not `surfaceMuted`) so the card stays visible on the
 * Figma light canvas — after the redesign, `surfaceMuted` equals `canvas`.
 */
export function PartnerCollapsibleCard({ title, total, children }: Props) {
  const [open, setOpen] = useState(false);
  const styles = useThemedStyles(createStyles);
  const countLabel = `${total} total`;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${countLabel}`}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed,
        ]}
      >
        <View style={styles.headerText}>
          <StrongText style={styles.title} numberOfLines={2}>
            {title}
          </StrongText>
          <CaptionText style={styles.meta}>
            {countLabel}
            {open ? '' : ' · Click to see details.'}
          </CaptionText>
        </View>
        <CaptionText style={styles.chevron}>{open ? '▾' : '▸'}</CaptionText>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    card: {
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      marginBottom: 2,
      overflow: 'hidden' as const,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: space.sm,
      paddingVertical: 14,
      paddingHorizontal: space.md,
    },
    headerPressed: {
      backgroundColor: colors.green[50],
    },
    headerText: {
      flex: 1,
      gap: 4,
      paddingRight: space.sm,
    },
    title: { color: colors.ink },
    meta: { color: colors.inkMuted },
    chevron: {
      color: colors.inkMuted,
      fontFamily: fonts.bodyStrong,
      fontSize: 16,
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: space.md,
      paddingBottom: 12,
      gap: 8,
    },
  };
}
