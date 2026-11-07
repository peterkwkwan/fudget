import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRef, useState, type ComponentRef } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons';
import {
  FixedMonthNavLabel,
  MonthSwipeNavLabel,
} from '@/components/MonthSwipeNavLabel';
import { CaptionText, PageTitleText, StrongText } from '@/components/StyledText';
import { fonts, radius, space, typography, type ThemeColors } from '@/constants/theme';
import {
  formatCompactDate,
  periodModeLabel,
  periodModeOptions,
  shiftPeriodFocus,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import { useTheme } from '@/lib/ThemeProvider';
import { useThemedStyles } from '@/lib/useThemedStyles';

/** Shared with MonthCardPager so the header month slides with the cards. */
export type PeriodSwipeMotion = {
  translateX: SharedValue<number>;
  pagerWidth: SharedValue<number>;
  prevLabel: string;
  nextLabel: string;
};

export type PeriodSelectorProps = {
  preset: PeriodPreset;
  navLabel: string;
  focus: PeriodFocus;
  timeZone: string;
  onFocusChange: (focus: PeriodFocus) => void;
  /** Stats shows Monthly/Yearly/Period; Transactions is month-only. Default true. */
  showModeMenu?: boolean;
  /**
   * When set, renders a Figma page-title row above the month stepper.
   * Stats puts the mode dropdown on this row; Transactions passes title only.
   */
  pageTitle?: string;
  /** Required when showModeMenu (Stats Period mode). */
  customStart?: Date;
  customEnd?: Date;
  onPresetChange?: (preset: PeriodPreset) => void;
  onCustomStartChange?: (date: Date) => void;
  onCustomEndChange?: (date: Date) => void;
  /**
   * When set (Monthly + card pager), finger-follow the month strip. Settle
   * recycles show* strings on the UI thread — no remap twitch.
   */
  swipeMotion?: PeriodSwipeMotion | null;
  /**
   * When set (Monthly + card pager), ‹ › use the same animate-then-commit path
   * as a pan settle instead of jumping focus immediately.
   */
  onSwipeStep?: (delta: -1 | 1) => void;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function PeriodSelector({
  preset,
  navLabel,
  focus,
  timeZone,
  customStart,
  customEnd,
  onPresetChange,
  onFocusChange,
  onCustomStartChange,
  onCustomEndChange,
  showModeMenu = true,
  pageTitle,
  swipeMotion = null,
  onSwipeStep,
}: PeriodSelectorProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const modeTriggerRef = useRef<ComponentRef<typeof View>>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 0 });
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const today = startOfDay(new Date());
  const fromDay = startOfDay(customStart ?? today);
  const toDay = startOfDay(customEnd ?? today);
  const effectivePreset = showModeMenu ? preset : 'month';

  const openModeMenu = () => {
    const fallbackTop = insets.top + 52;
    const node = modeTriggerRef.current as
      | (ComponentRef<typeof View> & {
          measureInWindow?: (
            cb: (x: number, y: number, width: number, height: number) => void
          ) => void;
        })
      | null;
    if (!node?.measureInWindow) {
      setMenuAnchor({ top: fallbackTop, right: space.md });
      setMenuOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      const screenW = Dimensions.get('window').width;
      setMenuAnchor({
        top: y + height + 4,
        right: Math.max(space.sm, screenW - (x + width)),
      });
      setMenuOpen(true);
    });
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPicking(null);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }

    const picked = startOfDay(date);

    if (picking === 'start') {
      onCustomStartChange?.(picked);
      if (picked.getTime() > toDay.getTime()) {
        onCustomEndChange?.(picked);
      }
    } else if (picking === 'end') {
      onCustomEndChange?.(picked);
      if (picked.getTime() < fromDay.getTime()) {
        onCustomStartChange?.(picked);
      }
    }
  };

  const fromMaximum = toDay.getTime() < today.getTime() ? toDay : today;
  const toMinimum = fromDay;

  const step = (delta: -1 | 1) => {
    if (effectivePreset === 'custom') return;
    if (effectivePreset === 'month' && onSwipeStep) {
      onSwipeStep(delta);
      return;
    }
    onFocusChange(shiftPeriodFocus(focus, effectivePreset, delta));
  };

  const modeTrigger = showModeMenu ? (
    <View ref={modeTriggerRef} collapsable={false}>
      <Pressable
        style={({ pressed }) => [
          styles.modeTrigger,
          pressed && styles.pressed,
        ]}
        onPress={openModeMenu}
        accessibilityRole="button"
        accessibilityLabel={`Period mode ${periodModeLabel(preset)}. Change mode.`}
        accessibilityHint="Opens Monthly, Yearly, or Period options"
      >
        <CaptionText style={styles.modeTriggerText}>
          {periodModeLabel(preset)}
        </CaptionText>
        <CaptionText style={styles.modeCaret}>▾</CaptionText>
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={styles.wrap}>
      {pageTitle ? (
        <View style={styles.pageTitleRow}>
          <PageTitleText
            style={styles.pageTitle}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {pageTitle}
          </PageTitleText>
          {modeTrigger}
        </View>
      ) : null}

      <View
        style={styles.bar}
        accessibilityRole="toolbar"
        accessibilityLabel="Period navigation"
      >
        {effectivePreset === 'custom' ? (
          <View style={styles.periodRange} accessibilityRole="text">
            <Pressable
              style={styles.dateField}
              onPress={() => setPicking('start')}
              accessibilityRole="button"
              accessibilityLabel={`Start date ${formatCompactDate(fromDay, timeZone)}`}
            >
              <CaptionText style={styles.dateFieldText}>
                {formatCompactDate(fromDay, timeZone)}
              </CaptionText>
              <CalendarIcon color={colors.inkMuted} size={14} />
            </Pressable>
            <CaptionText style={styles.tilde}>~</CaptionText>
            <Pressable
              style={styles.dateField}
              onPress={() => setPicking('end')}
              accessibilityRole="button"
              accessibilityLabel={`End date ${formatCompactDate(toDay, timeZone)}`}
            >
              <CaptionText style={styles.dateFieldText}>
                {formatCompactDate(toDay, timeZone)}
              </CaptionText>
              <CalendarIcon color={colors.inkMuted} size={14} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.stepper}>
            <View style={styles.monthSlot}>
              {swipeMotion ? (
                <MonthSwipeNavLabel
                  prevLabel={swipeMotion.prevLabel}
                  navLabel={navLabel}
                  nextLabel={swipeMotion.nextLabel}
                  translateX={swipeMotion.translateX}
                  pagerWidth={swipeMotion.pagerWidth}
                />
              ) : (
                <FixedMonthNavLabel label={navLabel} />
              )}
            </View>
            <View style={styles.chevronPair}>
              <Pressable
                onPress={() => step(-1)}
                style={({ pressed }) => [
                  styles.chevronBtn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  effectivePreset === 'month'
                    ? 'Previous month'
                    : 'Previous year'
                }
              >
                <ChevronLeftIcon color={colors.ink} size={18} />
              </Pressable>
              <Pressable
                onPress={() => step(1)}
                style={({ pressed }) => [
                  styles.chevronBtn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  effectivePreset === 'month' ? 'Next month' : 'Next year'
                }
              >
                <ChevronRightIcon color={colors.ink} size={18} />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {showModeMenu ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss period mode menu"
          >
            <Pressable
              style={[
                styles.menuSheet,
                {
                  position: 'absolute',
                  top: menuAnchor.top,
                  right: menuAnchor.right,
                  shadowColor: isDark ? '#000000' : '#202923',
                },
              ]}
              accessibilityRole="menu"
            >
              {periodModeOptions().map((opt, index, arr) => {
                const selected = preset === opt.value;
                const last = index === arr.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    style={({ pressed }) => [
                      styles.menuItem,
                      last && styles.menuItemLast,
                      selected && styles.menuItemSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      onPresetChange?.(opt.value);
                      setMenuOpen(false);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                  >
                    <StrongText
                      style={[
                        styles.menuItemText,
                        selected && styles.menuItemTextSelected,
                      ]}
                    >
                      {opt.label}
                    </StrongText>
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={picking === 'start' ? fromDay : toDay}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
          minimumDate={picking === 'end' ? toMinimum : undefined}
          maximumDate={picking === 'start' ? fromMaximum : today}
        />
      ) : null}
      {picking && Platform.OS === 'ios' ? (
        <Pressable
          style={styles.done}
          onPress={() => setPicking(null)}
          accessibilityRole="button"
        >
          <CaptionText style={styles.doneText}>Done</CaptionText>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    wrap: {
      width: '100%' as const,
      gap: 22,
    },
    pageTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: space.sm,
    },
    pageTitle: {
      flex: 1,
      color: colors.ink,
      ...typography.pageTitle,
    },
    bar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'flex-start' as const,
      flexWrap: 'nowrap' as const,
      minHeight: 34,
      alignSelf: 'stretch' as const,
      width: '100%' as const,
    },
    stepper: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: space.sm,
      flex: 1,
      minWidth: 0,
    },
    monthSlot: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start' as const,
    },
    chevronPair: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      flexShrink: 0,
    },
    chevronBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.tile,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    periodRange: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: space.xs,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    dateField: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      minHeight: 32,
    },
    dateFieldText: {
      color: colors.ink,
      fontFamily: fonts.caption,
      fontSize: 13,
    },
    tilde: {
      color: colors.inkMuted,
      paddingHorizontal: 2,
    },
    modeTrigger: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      minHeight: 32,
    },
    modeTriggerText: {
      color: colors.green[700],
      fontFamily: fonts.caption,
      fontSize: 12,
    },
    modeCaret: {
      color: colors.green[700],
      fontSize: 11,
      lineHeight: 14,
    },
    pressed: {
      opacity: 0.75,
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    menuSheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
      minWidth: 148,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    menuItem: {
      paddingVertical: space.sm + 4,
      paddingHorizontal: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemSelected: {
      backgroundColor: colors.green[50],
    },
    menuItemText: {
      color: colors.ink,
      fontSize: 16,
    },
    menuItemTextSelected: {
      color: colors.green[700],
    },
    done: {
      alignSelf: 'flex-end' as const,
      paddingHorizontal: space.md,
      height: 40,
      justifyContent: 'center' as const,
    },
    doneText: {
      color: colors.green[700],
      fontFamily: fonts.bodyStrong,
    },
  };
}
