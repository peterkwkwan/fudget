import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  /** When true, chips render selected state but ignore presses (inactive slots). */
  readOnly?: boolean;
  accessibilityLabel?: string;
};

/**
 * Chip row for Stats Expenses|Income (and Trend Expenses|Income|Net).
 * Figma: selected = green tint + green border; idle = white + hairline.
 */
export function StatsSegmentToggle<T extends string>({
  options,
  value,
  onChange,
  readOnly = false,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={
              readOnly || !onChange ? undefined : () => onChange(opt.value)
            }
            disabled={readOnly || !onChange}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: readOnly }}
          >
            <CaptionText
              style={[styles.text, selected && styles.textSelected]}
            >
              {opt.label}
            </CaptionText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const PIE_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
] as const;

export const TREND_METRIC_OPTIONS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'net', label: 'Net' },
] as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'flex-start',
    minHeight: 38,
  },
  chip: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.green[50],
    borderColor: colors.green[700],
  },
  text: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    letterSpacing: 0,
  },
  textSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
