import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, space, type ThemeColors } from '@/constants/theme';
import { MONTH_NAMES, monthPickerYears, type PeriodFocus } from '@/lib/periods';
import { useTheme } from '@/lib/ThemeProvider';
import { useThemedStyles } from '@/lib/useThemedStyles';

const ROW = 44;
const VISIBLE = 7;
const SIDE = (VISIBLE - 1) / 2;

type Props = {
  visible: boolean;
  focus: PeriodFocus;
  onCancel: () => void;
  onConfirm: (focus: PeriodFocus) => void;
};

type WheelHandle = {
  index: () => number;
};

type WheelProps = {
  items: readonly string[];
  initialIndex: number;
  align: 'left' | 'right';
  accessibilityLabel: string;
};

/**
 * Android month/year wheel. Draft selection stays local until Done so
 * Transactions and Stats do not move while the wheels are still spinning.
 */
export function MonthYearPicker({ visible, focus, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const monthRef = useRef<WheelHandle>(null);
  const yearRef = useRef<WheelHandle>(null);
  const years = monthPickerYears(focus.year, new Date().getFullYear());
  const yearIndex = Math.max(0, years.indexOf(focus.year));

  if (Platform.OS !== 'android' || !visible) return null;

  const confirm = () => {
    const month = (monthRef.current?.index() ?? focus.month - 1) + 1;
    const year = years[yearRef.current?.index() ?? yearIndex] ?? focus.year;
    onConfirm({ year, month });
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.canvas,
            paddingTop: Math.max(insets.top, space.sm),
            paddingBottom: Math.max(insets.bottom, space.md),
          },
        ]}
      >
        <View style={styles.toolbar}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Done. Show this month on Transactions and Stats"
          >
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.wheelHost}>
          <View style={styles.wheels}>
            <WheelColumn
              ref={monthRef}
              items={MONTH_NAMES}
              initialIndex={focus.month - 1}
              align="right"
              accessibilityLabel="Month"
            />
            <WheelColumn
              ref={yearRef}
              items={years.map(String)}
              initialIndex={yearIndex}
              align="left"
              accessibilityLabel="Year"
            />
            <View pointerEvents="none" style={styles.band} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const WheelColumn = forwardRef<WheelHandle, WheelProps>(function WheelColumn(
  { items, initialIndex, align, accessibilityLabel },
  ref
) {
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsetRef = useRef(initialIndex * ROW);
  const didAlign = useRef(false);
  const [offset, setOffset] = useState(initialIndex * ROW);

  useImperativeHandle(ref, () => ({
    index: () => clampIndex(Math.round(offsetRef.current / ROW), items.length),
  }));

  // contentOffset is unreliable on Android until layout. Align once, then
  // leave the wheel alone so a later layout doesn't snap back mid-spin.
  const alignToInitial = () => {
    if (didAlign.current) return;
    didAlign.current = true;
    const y = initialIndex * ROW;
    offsetRef.current = y;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  };

  const remember = (y: number) => {
    offsetRef.current = y;
    setOffset(y);
  };

  const settle = (y: number) => {
    const index = clampIndex(Math.round(y / ROW), items.length);
    const target = index * ROW;
    offsetRef.current = target;
    setOffset(target);
    if (Math.abs(y - target) > 1) {
      scrollRef.current?.scrollTo({ y: target, animated: true });
    }
  };

  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) > 0.05) return;
    settle(event.nativeEvent.contentOffset.y);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.column}
      contentContainerStyle={styles.columnContent}
      contentOffset={{ x: 0, y: initialIndex * ROW }}
      onLayout={alignToInitial}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW}
      snapToAlignment="start"
      decelerationRate="fast"
      overScrollMode="never"
      nestedScrollEnabled
      scrollEventThrottle={16}
      accessibilityLabel={accessibilityLabel}
      onScroll={(event) => remember(event.nativeEvent.contentOffset.y)}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
    >
      {items.map((item, index) => {
        const distance = Math.abs(index - offset / ROW);
        const selected = distance < 0.5;
        const opacity = selected ? 1 : Math.max(0.16, 1 - distance * 0.28);
        return (
          <Text
            key={item}
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.rowText,
              align === 'right' ? styles.alignRight : styles.alignLeft,
              selected && styles.rowTextSelected,
              { opacity },
            ]}
          >
            {item}
          </Text>
        );
      })}
    </ScrollView>
  );
});

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, index));
}

function createStyles(colors: ThemeColors) {
  return {
    screen: {
      flex: 1,
      paddingHorizontal: space.screen,
    },
    toolbar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      minHeight: 44,
    },
    cancel: {
      color: colors.inkMuted,
      fontFamily: fonts.body,
      fontSize: 16,
    },
    done: {
      color: colors.green[700],
      fontFamily: fonts.bodyStrong,
      fontSize: 16,
    },
    wheelHost: {
      flex: 1,
      justifyContent: 'center' as const,
    },
    wheels: {
      height: ROW * VISIBLE,
      flexDirection: 'row' as const,
      position: 'relative' as const,
    },
    column: {
      flex: 1,
    },
    columnContent: {
      paddingVertical: ROW * SIDE,
    },
    band: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: ROW * SIDE,
      height: ROW,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.inkSoft,
    },
    rowText: {
      height: ROW,
      lineHeight: ROW,
      fontSize: 18,
      fontFamily: fonts.body,
      color: colors.inkMuted,
      // shortcut: fixed row metrics so snap stays one row; a scaled-font
      // fallback would need a non-wheel picker.
      includeFontPadding: false,
    },
    rowTextSelected: {
      fontSize: 20,
      fontFamily: fonts.bodyStrong,
      color: colors.ink,
    },
    alignRight: {
      textAlign: 'right' as const,
      paddingRight: 22,
    },
    alignLeft: {
      textAlign: 'left' as const,
      paddingLeft: 22,
    },
  };
}
