import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { PENDING_SYNC_COPY } from '@/lib/offline/ux';

/** Small amber marker for a local edit waiting on cloud sync. */
export function PendingSyncDot() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={styles.dot}
      accessible
      accessibilityLabel={PENDING_SYNC_COPY}
      accessibilityRole="image"
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.rust[400],
    },
  });
}
