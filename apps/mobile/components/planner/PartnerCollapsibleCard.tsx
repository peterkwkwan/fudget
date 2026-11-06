import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, space } from '@/constants/theme';

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
 */
export function PartnerCollapsibleCard({ title, total, children }: Props) {
  const [open, setOpen] = useState(false);
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

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: 14,
    paddingHorizontal: 14,
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
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
});
