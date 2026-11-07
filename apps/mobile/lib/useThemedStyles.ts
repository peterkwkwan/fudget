import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build StyleSheet from the active palette. Re-creates when Light/Dark flips.
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: ThemeColors) => T | NamedStyles<T>
): T {
  const { colors, scheme } = useTheme();
  return useMemo(
    () => StyleSheet.create(factory(colors)) as T,
    // scheme covers identity when palette object is stable per scheme
    // eslint-disable-next-line react-hooks/exhaustive-deps -- factory is inline per call site
    [colors, scheme]
  );
}
