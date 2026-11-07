import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  radius,
  space,
  type ThemeColors,
  type ThemeShadow,
} from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tighter padding for dense lists (default 0 — callers pad rows). */
  padded?: boolean;
};

/** Elevated surface card matching Figma rounded surfaces on canvas. */
export function SurfaceCard({ children, style, padded = false }: Props) {
  const { colors, shadow } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, shadow),
    [colors, shadow]
  );

  return (
    <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
  );
}

function createStyles(colors: ThemeColors, shadow: ThemeShadow) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadow.card,
    },
    padded: {
      padding: space.md,
    },
  });
}
