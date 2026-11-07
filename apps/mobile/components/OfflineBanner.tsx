import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

type OfflineBannerProps = {
  /** When null/undefined/empty, the banner is hidden. Screens supply copy. */
  message: string | null | undefined;
};

/**
 * Full-bleed status bar under the navbar (Transactions chrome).
 * Dumb: no gates, no variants — pass the message text.
 */
export function OfflineBanner({ message }: OfflineBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!message) return null;

  return (
    <View style={styles.bar} accessibilityRole="text">
      <CaptionText style={styles.text}>{message}</CaptionText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    text: {
      color: colors.ink,
    },
  });
}
