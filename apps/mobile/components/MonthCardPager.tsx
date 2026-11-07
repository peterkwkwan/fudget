import { useMemo, forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import {
  MONTH_CARD_SNAP_MS,
  MONTH_FILL_FADE_MS,
  MONTH_SWIPE_ACTIVATION_PX,
  MONTH_SWIPE_FAIL_Y_PX,
  monthContentKey,
  monthStepDirection,
  monthStepFromCardSwipe,
} from '@/lib/monthSwipe';
import type { PeriodFocus } from '@/lib/periods';

type MonthCardPagerProps = {
  /** Focused calendar month — only this month’s body is live. */
  focus: PeriodFocus;
  /**
   * When false, render only the current page (no gesture / blank flanks).
   * Stats uses this outside Monthly mode.
   */
  enabled: boolean;
  onStep: (delta: -1 | 1) => void;
  style?: StyleProp<ViewStyle>;
  /** Full month UI for the focused month only. */
  renderPage: (focus: PeriodFocus) => ReactNode;
  /**
   * True when the focused month body can paint in one shot (full or empty).
   * Until then the center stays paper-white; then a short fade-in.
   */
  contentReady: boolean;
  /**
   * Optional external shared values for the sliding track. When omitted the
   * pager owns internal values. Navbar month label is settle-only and does
   * not subscribe to these.
   */
  translateX?: SharedValue<number>;
  pagerWidth?: SharedValue<number>;
};

export type MonthCardPagerHandle = {
  /** Animate like a committed pan, then call `onStep` (header ‹ › path). */
  step: (delta: -1 | 1) => void;
};

const easeOut = Easing.out(Easing.cubic);

/**
 * Blank-then-fill month pager.
 * Drag left/right: current body translates + fades out; paper-white blanks
 * slide in. After settle, focus commits and content fills when ready
 * (one-shot fade-in). Navbar month label updates from settled focus only —
 * it does not finger-follow this track. Chevron ‹ › uses the same step path.
 */
export const MonthCardPager = forwardRef<
  MonthCardPagerHandle,
  MonthCardPagerProps
>(function MonthCardPager(
  {
    focus,
    enabled,
    onStep,
    style,
    renderPage,
    contentReady,
    translateX: translateXProp,
    pagerWidth: pagerWidthProp,
  },
  ref
) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const widthInternal = useSharedValue(0);
  const translateInternal = useSharedValue(0);
  const fillOpacity = useSharedValue(contentReady ? 1 : 0);
  const widthSV = pagerWidthProp ?? widthInternal;
  const translateX = translateXProp ?? translateInternal;

  const ignoreFocusAnimRef = useRef(false);
  const prevFocusRef = useRef(focus);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const focusKey = monthContentKey(focus);

  const commitStep = useCallback((delta: -1 | 1) => {
    ignoreFocusAnimRef.current = true;
    onStepRef.current(delta);
  }, []);

  const animateStep = useCallback(
    (delta: -1 | 1) => {
      const w = widthSV.value;
      if (!(w > 0)) {
        commitStep(delta);
        return;
      }
      translateX.value = withTiming(
        -delta * w,
        { duration: MONTH_CARD_SNAP_MS, easing: easeOut },
        (finished) => {
          'worklet';
          if (!finished) return;
          runOnJS(commitStep)(delta);
        }
      );
    },
    [commitStep, translateX, widthSV]
  );

  useImperativeHandle(ref, () => ({ step: animateStep }), [animateStep]);

  /**
   * Snap / commit on the JS thread (`monthStepFromCardSwipe` is not a worklet).
   * On a committed step, keep translateX at the page offset until focus updates,
   * then reset to 0 in useLayoutEffect before paint.
   */
  const settleSwipe = useCallback(
    (translationXValue: number, velocityX: number, width: number) => {
      const step = monthStepFromCardSwipe(
        translationXValue,
        velocityX,
        width
      );
      const target = step === 0 ? 0 : -step * width;
      translateX.value = withTiming(
        target,
        { duration: MONTH_CARD_SNAP_MS, easing: easeOut },
        (finished) => {
          'worklet';
          if (!finished || step === 0) return;
          runOnJS(commitStep)(step);
        }
      );
    },
    [commitStep, translateX]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const w = event.nativeEvent.layout.width;
      if (w > 0) widthSV.value = w;
    },
    [widthSV]
  );

  // Swipe settle: recenter before paint. External focus (rare): slide like chevron.
  useLayoutEffect(() => {
    const from = prevFocusRef.current;
    const step = monthStepDirection(from, focus);
    prevFocusRef.current = focus;
    if (ignoreFocusAnimRef.current) {
      ignoreFocusAnimRef.current = false;
      translateX.value = 0;
      return;
    }
    if (!enabled || step === 0 || widthSV.value <= 0) return;
    translateX.value = -step * widthSV.value;
    translateX.value = withTiming(0, {
      duration: MONTH_CARD_SNAP_MS,
      easing: easeOut,
    });
  }, [enabled, focus.year, focus.month, translateX, widthSV]);

  // Blank until ready; one-shot fade-in. Focus change resets immediately.
  useEffect(() => {
    if (!contentReady) {
      fillOpacity.value = 0;
      return;
    }
    fillOpacity.value = withTiming(1, {
      duration: MONTH_FILL_FADE_MS,
      easing: easeOut,
    });
  }, [contentReady, fillOpacity, focusKey]);

  const gesture = usePanGesture({
    enabled,
    activeOffsetX: [-MONTH_SWIPE_ACTIVATION_PX, MONTH_SWIPE_ACTIVATION_PX],
    failOffsetY: [-MONTH_SWIPE_FAIL_Y_PX, MONTH_SWIPE_FAIL_Y_PX],
    onUpdate: (event) => {
      'worklet';
      const w = widthSV.value;
      if (!(w > 0)) return;
      const next = event.translationX;
      translateX.value = Math.max(-w, Math.min(w, next));
    },
    onDeactivate: (event) => {
      'worklet';
      const w = widthSV.value;
      if (event.canceled || !(w > 0)) {
        translateX.value = withTiming(0, {
          duration: MONTH_CARD_SNAP_MS,
          easing: easeOut,
        });
        return;
      }
      runOnJS(settleSwipe)(event.translationX, event.velocityX, w);
    },
  });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Exit fade while the current page leaves; fill fade when data is ready.
  const currentStyle = useAnimatedStyle(() => {
    const w = widthSV.value;
    const exit =
      w > 0 ? Math.min(1, Math.abs(translateX.value) / w) : 0;
    return {
      opacity: fillOpacity.value * (1 - exit),
    };
  });

  if (!enabled) {
    return (
      <View style={[styles.clip, style]}>
        <Animated.View
          style={[styles.fillHost, currentStyle]}
          pointerEvents={contentReady ? 'box-none' : 'none'}
        >
          {renderPage(focus)}
        </Animated.View>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <View style={[styles.clip, style]} onLayout={onLayout}>
        <Animated.View style={[styles.track, trackStyle]}>
          <View
            style={[styles.page, styles.pagePrev, styles.blank]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Animated.View
            style={[styles.pageCurrent, currentStyle]}
            pointerEvents={contentReady ? 'box-none' : 'none'}
          >
            {/* Mount while loading so queries run; opacity stays 0 until ready. */}
            {renderPage(focus)}
          </Animated.View>
          <View
            style={[styles.page, styles.pageNext, styles.blank]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  track: {
    flex: 1,
  },
  pageCurrent: {
    flex: 1,
  },
  fillHost: {
    flex: 1,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
  },
  pagePrev: {
    left: '-100%',
  },
  pageNext: {
    left: '100%',
  },
  blank: {
    backgroundColor: colors.canvas,
  },
});
}

