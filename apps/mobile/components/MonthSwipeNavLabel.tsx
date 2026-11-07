import { useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { fonts, typography, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';

/**
 * Longest Monthly nav label — fixed slot so ‹ › do not shift
 * (May 2026 vs September 2026). Year is always four digits.
 */
export const LONGEST_MONTH_NAV_LABEL = 'September 2026';

type Props = {
  prevLabel: string;
  navLabel: string;
  nextLabel: string;
  /** Same translateX as MonthCardPager’s track. */
  translateX: SharedValue<number>;
  /** Pager width SharedValue from MonthCardPager. */
  pagerWidth: SharedValue<number>;
};

type FixedLabelProps = {
  label: string;
};

/**
 * Single month/year label in a longest-label-width slot (static path when
 * there is no swipe motion — Yearly, or Monthly before the pager mounts).
 */
export function FixedMonthNavLabel({ label }: FixedLabelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [slotW, setSlotW] = useState(0);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      collapsable={false}
    >
      <LongestNavLabelProbe styles={styles} onLayout={onMeasure} />
      <Text
        style={[styles.label, slotW > 0 ? { width: slotW } : null]}
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLabel={label}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Month title strip that tracks the card pager’s translateX so
 * ‹ November 2026 › slides toward October with the swipe (not after settle).
 *
 * Slot width is locked to “September 2026” so chevrons stay put when
 * swiping May ↔ September. Labels are centered in that slot.
 *
 * Shared values are only written from layout/effects (never during render).
 */
export function MonthSwipeNavLabel({
  prevLabel,
  navLabel,
  nextLabel,
  translateX,
  pagerWidth,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slotSV = useSharedValue(0);
  const [slotW, setSlotW] = useState(0);

  // Mirror React width into the shared value after commit — never in render.
  useLayoutEffect(() => {
    slotSV.value = slotW;
  }, [slotW, slotSV]);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

  const stripStyle = useAnimatedStyle(() => {
    const pw = pagerWidth.value;
    const lw = slotSV.value;
    if (!(pw > 0) || !(lw > 0)) {
      return { transform: [{ translateX: -lw }] };
    }
    // Pager: +width shows prev, −width shows next.
    // Strip is [prev][current][next]; start at −lw (current in view).
    const progress = translateX.value / pw;
    return {
      transform: [{ translateX: -lw + progress * lw }],
    };
  });

  const slotStyle = slotW > 0 ? { width: slotW } : undefined;

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      // Content-sized — never grow into the header leftover (that pushed › away).
      collapsable={false}
    >
      <LongestNavLabelProbe styles={styles} onLayout={onMeasure} />

      {slotW <= 0 ? (
        <Text
          style={styles.label}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={navLabel}
        >
          {navLabel}
        </Text>
      ) : (
        <View
          style={[styles.viewport, { width: slotW }]}
          accessibilityRole="header"
        >
          <Animated.View style={[styles.strip, stripStyle]}>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {prevLabel}
            </Animated.Text>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityLabel={navLabel}
            >
              {navLabel}
            </Animated.Text>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {nextLabel}
            </Animated.Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function LongestNavLabelProbe({
  styles,
  onLayout,
}: {
  styles: ReturnType<typeof createStyles>;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      style={styles.measureLayer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={styles.measureLabel}
        numberOfLines={1}
        onLayout={onLayout}
      >
        {LONGEST_MONTH_NAV_LABEL}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    alignSelf: 'flex-start',
    position: 'relative',
    maxWidth: '100%',
  },
  measureLayer: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
  },
  measureLabel: {
    color: colors.ink,
    ...typography.month,
    fontFamily: fonts.bodyStrong,
  },
  viewport: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: colors.ink,
    ...typography.month,
    textAlign: 'left',
    fontFamily: fonts.bodyStrong,
  },
});
}

