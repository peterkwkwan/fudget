import { Pressable, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import {
  fonts,
  radius,
  space,
  type ColorSchemePreference,
  type ThemeColors,
} from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { useThemedStyles } from '@/lib/useThemedStyles';

const OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Explicit Light · Dark segmented control (Figma Dark · Account language:
 * muted track, mint/forest selected fill, inkInverse label on selected).
 */
export function AppearanceToggle() {
  const { scheme, setScheme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="tablist"
      accessibilityLabel="Appearance"
    >
      {OPTIONS.map((opt) => {
        const selected = scheme === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.pressed,
            ]}
            onPress={() => setScheme(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <CaptionText
              style={[styles.label, selected && styles.labelSelected]}
            >
              {opt.label}
            </CaptionText>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    wrap: {
      padding: 3,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row' as const,
      gap: 2,
    },
    segment: {
      flex: 1,
      borderRadius: radius.md,
      paddingVertical: space.sm,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: 36,
    },
    segmentSelected: {
      backgroundColor: colors.green[700],
    },
    pressed: {
      backgroundColor: colors.border,
    },
    label: {
      color: colors.inkMuted,
      fontFamily: fonts.bodyStrong,
      fontSize: 12,
      lineHeight: 16,
    },
    labelSelected: {
      color: colors.inkInverse,
    },
  };
}
