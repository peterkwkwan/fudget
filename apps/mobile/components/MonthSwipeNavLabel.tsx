import { useMemo, useCallback, useLayoutEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
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
  /** Android month/year wheel. Omit on iOS so the label stays a header. */
  onPress?: () => void;
};

type FixedLabelProps = {
  label: string;
  /** Android month/year wheel. Omit on iOS so the label stays a header. */
  onPress?: () => void;
};

/**
 * Single month/year label in a longest-label-width slot (Yearly / no swipe).
 */
export function FixedMonthNavLabel({ label, onPress }: FixedLabelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [slotW, setSlotW] = useState(0);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

  const text = (
    <Text
      style={[styles.label, slotW > 0 ? { width: slotW } : null]}
      numberOfLines={1}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : 'header'}
      accessibilityLabel={onPress ? undefined : label}
    >
      {label}
    </Text>
  );

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      collapsable={false}
    >
      <LongestNavLabelProbe styles={styles} onLayout={onMeasure} />
      {onPress ? (
        <Pressable
          onPress={onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`${label}. Choose month and year`}
          accessibilityHint="Opens the month and year picker"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {text}
        </Pressable>
      ) : (
        text
      )}
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
  onPress,
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

  const clipStyle = [styles.viewport, slotW > 0 ? { width: slotW } : null];
  const labelNode = (
    <Animated.Text
      style={[styles.label, slotW > 0 ? { width: slotW } : null, labelStyle]}
      numberOfLines={1}
      accessible={onPress ? false : undefined}
    >
      {navLabel}
    </Animated.Text>
  );

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      collapsable={false}
    >
      <LongestNavLabelProbe styles={styles} onLayout={onMeasure} />
      <View
        style={clipStyle}
        accessible={onPress ? false : undefined}
        accessibilityRole={onPress ? undefined : 'header'}
        accessibilityLabel={onPress ? undefined : navLabel}
      >
        {labelNode}
        {onPress ? (
          <Pressable
            onPress={onPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${navLabel}. Choose month and year`}
            accessibilityHint="Opens the month and year picker"
            style={styles.hitTarget}
          />
        ) : null}
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
    hitTarget: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    label: {
      color: colors.ink,
      ...typography.month,
      textAlign: 'left',
      fontFamily: fonts.bodyStrong,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
