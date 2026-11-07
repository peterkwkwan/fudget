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
  navLabel: string;
  /** Same translateX as MonthCardPager’s track. */
  translateX: SharedValue<number>;
  /** Pager width SharedValue from MonthCardPager. */
  pagerWidth: SharedValue<number>;
  /**
   * Same fill opacity as the pager body (0 while blank / loading, 1 when
   * contentReady). Label exits with the swipe then stays absent until fill.
   */
  fillOpacity: SharedValue<number>;
};

type FixedLabelProps = {
  label: string;
};

/**
 * Single month/year label in a longest-label-width slot (Yearly / no swipe).
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
 * Single current-month label that finger-follows the card pager.
 *
 * - Drag / snap: label translates + fades out with the page (no prev/next peek).
 * - After commit while loading: fillOpacity stays 0 → label absent.
 * - When contentReady: fillOpacity fades in → settled label + page together.
 *
 * Slot width stays locked to “September 2026” so chevrons do not shift.
 */
export function MonthSwipeNavLabel({
  navLabel,
  translateX,
  pagerWidth,
  fillOpacity,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slotSV = useSharedValue(0);
  const [slotW, setSlotW] = useState(0);

  useLayoutEffect(() => {
    slotSV.value = slotW;
  }, [slotW, slotSV]);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

  // Match MonthCardPager currentStyle: slide with the track + exit fade,
  // gated by the shared fill opacity (blank until contentReady).
  const labelStyle = useAnimatedStyle(() => {
    const pw = pagerWidth.value;
    const lw = slotSV.value;
    const exit = pw > 0 ? Math.min(1, Math.abs(translateX.value) / pw) : 0;
    const progress = pw > 0 ? translateX.value / pw : 0;
    return {
      opacity: fillOpacity.value * (1 - exit),
      transform: [{ translateX: progress * (lw > 0 ? lw : 0) }],
    };
  });

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      collapsable={false}
    >
      <LongestNavLabelProbe styles={styles} onLayout={onMeasure} />
      <View
        style={[styles.viewport, slotW > 0 ? { width: slotW } : null]}
        accessibilityRole="header"
        accessibilityLabel={navLabel}
      >
        <Animated.Text
          style={[styles.label, slotW > 0 ? { width: slotW } : null, labelStyle]}
          numberOfLines={1}
        >
          {navLabel}
        </Animated.Text>
      </View>
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
      flexShrink: 0,
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
    label: {
      color: colors.ink,
      ...typography.month,
      textAlign: 'left',
      fontFamily: fonts.bodyStrong,
    },
  });
}
