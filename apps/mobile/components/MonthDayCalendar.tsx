import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { SurfaceCard } from '@/components/SurfaceCard';
import { radius, space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import type { PeriodFocus } from '@/lib/periods';
import {
  WEEKDAY_LETTERS_SUN,
  formatDayNet,
  monthGridCells,
  type DayNetTone,
} from '@/lib/transactionsDateView';

type Props = {
  focus: PeriodFocus;
  selectedDay: number;
  /** Day-of-month → net (income − expenses). Omitted days have no transactions. */
  dayNets: ReadonlyMap<number, number>;
  onSelectDay: (day: number) => void;
  /** Account currency for day net chips (default HKD). */
  currency?: string;
};

function toneColor(tone: DayNetTone, colors: ThemeColors): string {
  if (tone === 'income') return colors.income;
  if (tone === 'expense') return colors.expense;
  return colors.inkMuted;
}

/** Full month grid in a white card; each day with transactions shows that day's net. */
export function MonthDayCalendar({
  focus,
  selectedDay,
  dayNets,
  onSelectDay,
  currency,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cells = monthGridCells(focus);

  return (
    <View style={styles.outer}>
      <SurfaceCard style={styles.card}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LETTERS_SUN.map((lab, i) => (
            <View key={`${lab}-${i}`} style={styles.weekdayCell}>
              <CaptionText style={styles.weekdayLabel}>{lab}</CaptionText>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day == null) {
              return <View key={`e-${i}`} style={styles.dayCell} />;
            }
            const selected = day === selectedDay;
            const net = dayNets.get(day);
            const label =
              net == null
                ? null
                : formatDayNet(net, { compact: true, plain: true, currency });
            return (
              <Pressable
                key={day}
                style={({ pressed }) => [
                  styles.dayCell,
                  selected && styles.dayCellSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => onSelectDay(day)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${day}${
                  label ? `, net ${label.text}` : ', no transactions'
                }${selected ? ', selected' : ''}`}
              >
                <StrongText
                  style={[styles.dayNum, selected && styles.dayNumSelected]}
                >
                  {day}
                </StrongText>
                {label ? (
                  <CaptionText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.amount, { color: toneColor(label.tone, colors) }]}
                  >
                    {label.text}
                  </CaptionText>
                ) : (
                  <View style={styles.amountSlot} />
                )}
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  outer: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
  },
  card: {
    padding: 10,
    gap: 6,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  weekdayLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Cells are 1/7 of the row. A column gap makes that overflow, so the
    // Saturday cell wraps and later dates sit under the wrong weekday.
    rowGap: 1,
  },
  dayCell: {
    width: '14.2857%',
    height: 47,
    alignItems: 'center',
    paddingTop: 8,
    borderRadius: radius.tile,
    gap: 4,
    backgroundColor: colors.surface,
  },
  dayCellSelected: {
    backgroundColor: colors.green[50],
  },
  pressed: {
    opacity: 0.75,
  },
  dayNum: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: undefined,
  },
  dayNumSelected: {
    color: colors.green[700],
  },
  amount: {
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  amountSlot: {
    height: 10,
  },
});
}

