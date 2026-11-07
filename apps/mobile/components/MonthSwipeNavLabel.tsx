import { useMemo, useCallback, useLayoutEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { fonts, typography, type ThemeColors } from '@/constants/theme';
import {
  isPagerAtPageOffset,
  isPagerSettleRecenter,
} from '@/lib/monthSwipe';
import { useTheme } from '@/lib/ThemeProvider';

/**
 * Longest Monthly nav label — fixed slot so ‹ › do not shift
 * (May 2026 vs September 2026). Year is always four digits.
 */
export const LONGEST_MONTH_NAV_LABEL = 'September 2026';

const AnimatedLabelInput = Animated.createAnimatedComponent(TextInput);

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
 * Finger-follow month strip synced to the card pager’s translateX.
 *
 * Settle without twitch: painted strings live in SharedValues (`show*`).
 * When focus commits, React writes the new trio into `pending*` while the
 * track is still at ±pagerWidth (destination month stays visible in the
 * next/prev cell). When the pager snaps `translateX → 0`, a UI-thread
 * reaction copies `pending* → show*` in that same frame — recycle without
 * teleporting glyphs backward. No React text rewrite racing the transform.
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

  const pendingPrev = useSharedValue(prevLabel);
  const pendingCurr = useSharedValue(navLabel);
  const pendingNext = useSharedValue(nextLabel);
  const showPrev = useSharedValue(prevLabel);
  const showCurr = useSharedValue(navLabel);
  const showNext = useSharedValue(nextLabel);

  useLayoutEffect(() => {
    slotSV.value = slotW;
  }, [slotW, slotSV]);

  // Stage the new trio. Adopt immediately when already centered (external
  // focus jump). During a committed swipe we stay on the old show* until
  // translateX hits 0 — see useAnimatedReaction below.
  useLayoutEffect(() => {
    pendingPrev.value = prevLabel;
    pendingCurr.value = navLabel;
    pendingNext.value = nextLabel;
    const atRest =
      pagerWidth.value <= 0 ||
      !isPagerAtPageOffset(translateX.value, pagerWidth.value);
    if (atRest && Math.abs(translateX.value) <= 1) {
      showPrev.value = prevLabel;
      showCurr.value = navLabel;
      showNext.value = nextLabel;
    }
  }, [
    prevLabel,
    navLabel,
    nextLabel,
    pendingPrev,
    pendingCurr,
    pendingNext,
    showPrev,
    showCurr,
    showNext,
    translateX,
    pagerWidth,
  ]);

  useAnimatedReaction(
    () => translateX.value,
    (tx, prevTx) => {
      'worklet';
      if (prevTx == null) return;
      if (!isPagerSettleRecenter(prevTx, tx, pagerWidth.value)) return;
      // Same UI frame as pager recenter — recycle offscreen cells only.
      showPrev.value = pendingPrev.value;
      showCurr.value = pendingCurr.value;
      showNext.value = pendingNext.value;
    },
    [translateX, pagerWidth, pendingPrev, pendingCurr, pendingNext, showPrev, showCurr, showNext]
  );

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
    const progress = translateX.value / pw;
    return {
      transform: [{ translateX: -lw + progress * lw }],
    };
  });

  const slotStyle = slotW > 0 ? { width: slotW } : undefined;

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
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
          accessibilityLabel={navLabel}
        >
          <Animated.View style={[styles.strip, stripStyle]}>
            <StripCell
              textSV={showPrev}
              defaultValue={prevLabel}
              style={[styles.label, styles.labelInput, slotStyle]}
            />
            <StripCell
              textSV={showCurr}
              defaultValue={navLabel}
              style={[styles.label, styles.labelInput, slotStyle]}
            />
            <StripCell
              textSV={showNext}
              defaultValue={nextLabel}
              style={[styles.label, styles.labelInput, slotStyle]}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function StripCell({
  textSV,
  defaultValue,
  style,
}: {
  textSV: SharedValue<string>;
  defaultValue: string;
  style: StyleProp<TextStyle>;
}) {
  // Reanimated drives `text` on the UI thread; cast keeps RN 0.88 / Reanimated 4 typings happy.
  const animatedProps = useAnimatedProps(
    () =>
      ({
        text: textSV.value,
      }) as Partial<{ text: string }>
  );

  return (
    <AnimatedLabelInput
      animatedProps={animatedProps as never}
      defaultValue={defaultValue}
      editable={false}
      caretHidden
      showSoftInputOnFocus={false}
      underlineColorAndroid="transparent"
      multiline={false}
      numberOfLines={1}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={style}
    />
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
    labelInput: {
      padding: 0,
      margin: 0,
      // TextInput defaults add Android padding that shifts glyphs vs Text.
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
  });
}
