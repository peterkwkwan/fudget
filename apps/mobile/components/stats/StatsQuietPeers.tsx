import { View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { radius, space, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/lib/useThemedStyles';

export type QuietPeer = {
  label: string;
  value: string;
};

type Props = {
  peers: readonly QuietPeer[];
  /**
   * When true, keep the Spent/Earned/Net row height but show soft bones
   * instead of amounts — avoids CLS when totals resolve after the list.
   */
  placeholder?: boolean;
};

/** Fixed-height Spent / Earned / Net row under the donut. */
export function StatsQuietPeers({ peers, placeholder = false }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.row}
      accessibilityLabel={placeholder ? 'Loading period totals' : undefined}
    >
      {peers.map((peer) => (
        <View key={peer.label} style={styles.peer}>
          <CaptionText style={styles.label}>{peer.label}</CaptionText>
          {placeholder ? (
            <View style={styles.bone} />
          ) : (
            <StrongText style={styles.value}>{peer.value}</StrongText>
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    row: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      justifyContent: 'center' as const,
      gap: space.md,
      // Label 14 + value 18 + gap 2 — keep even when values/bones swap.
      minHeight: 34,
      paddingBottom: space.xs,
    },
    peer: {
      alignItems: 'center' as const,
      gap: 2,
      minWidth: 72,
      minHeight: 34,
      justifyContent: 'center' as const,
    },
    label: {
      color: colors.inkMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    value: {
      color: colors.inkMuted,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ['tabular-nums'] as const,
    },
    bone: {
      width: 56,
      height: 14,
      marginTop: 2,
      borderRadius: radius.sm / 2,
      backgroundColor: colors.surfaceMuted,
    },
  };
}
