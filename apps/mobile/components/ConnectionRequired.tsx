import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { space, typography, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

/** Centered one-line block for an online-only screen while offline. */
export function ConnectionRequired({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <CaptionText style={styles.text}>{message}</CaptionText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: space.lg,
      paddingVertical: space.xxl,
      alignItems: 'center',
    },
    text: {
      color: colors.ink,
      textAlign: 'center',
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
    },
  });
}
