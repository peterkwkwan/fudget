import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { fonts, radius, space, type ThemeColors } from '@/constants/theme';
import type { TransactionsDateView } from '@/lib/profile';
import { useTheme } from '@/lib/ThemeProvider';

const OPTIONS: { value: TransactionsDateView; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
];

type Props = {
  value: TransactionsDateView;
  onChange: (view: TransactionsDateView) => void;
};

/** Segmented control: List · Calendar for Transactions date layouts. */
export function DateViewToggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="tablist"
      accessibilityLabel="Transactions date view"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.pressed,
            ]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              opt.value === 'list' ? 'List by day' : 'Month calendar'
            }
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
  return StyleSheet.create({
    wrap: {
      padding: 3,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row',
      gap: 2,
    },
    segment: {
      flex: 1,
      borderRadius: radius.md,
      paddingVertical: space.sm,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
}
