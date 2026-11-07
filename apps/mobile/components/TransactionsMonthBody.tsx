import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { MonthDayCalendar } from '@/components/MonthDayCalendar';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionsEmptyMonth } from '@/components/TransactionsEmptyMonth';
import { UpcomingRepeatsBar } from '@/components/UpcomingRepeatsBar';
import { WeekDayStrip } from '@/components/WeekDayStrip';
import { fonts, radius, space, typography, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { resolvePeriodBounds, type PeriodFocus } from '@/lib/periods';
import type { TransactionsDateView } from '@/lib/profile';
import {
  filterTransactionsForMonth,
  summarizeUpcomingRepeatsThisMonth,
  type Transaction,
  type UpcomingRepeatsSummary,
} from '@/lib/transactions';
import {
  dayNetsInMonth,
  filterTransactionsForDay,
  formatDayNet,
  formatFocusDayHeading,
  groupTransactionsByDay,
  netOfTransactions,
  type DayNetTone,
} from '@/lib/transactionsDateView';

export type TransactionsMonthBodyProps = {
  focus: PeriodFocus;
  /** Full unfiltered list — null/undefined while the query is still loading. */
  allRows: Transaction[] | undefined;
  listLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  onRefetch: () => void;
  timeZone: string;
  dateView: TransactionsDateView;
  currency: string;
  pendingIds: Set<string>;
  categoryFixIds: Set<string>;
  /** Focused month — selection + navigation enabled. */
  active: boolean;
  /** Day to highlight in calendar / day strip. */
  selectedDay: number;
  onSelectedDayChange?: (day: number) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onRowPress: (item: Transaction) => void;
  onRowLongPress: (id: string) => void;
};

/**
 * Full Transactions month UI for one calendar month.
 * MonthCardPager mounts only the focused month (blank flanks during swipe).
 */
export function TransactionsMonthBody({
  focus,
  allRows,
  listLoading,
  isError,
  error,
  isRefetching,
  onRefetch,
  timeZone,
  dateView,
  currency,
  pendingIds,
  categoryFixIds,
  active,
  selectedDay,
  onSelectedDayChange,
  selectionMode,
  selectedIds,
  onRowPress,
  onRowLongPress,
}: TransactionsMonthBodyProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { edges, scrollProps } = useScrollEdges();

  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus.year, focus.month]
  );

  const ready = !listLoading && allRows != null;

  const data = useMemo(
    () =>
      ready ? filterTransactionsForMonth(allRows, timeZone, focus) : [],
    [ready, allRows, timeZone, focus.year, focus.month]
  );

  const upcoming: UpcomingRepeatsSummary | null = useMemo(
    () =>
      ready
        ? summarizeUpcomingRepeatsThisMonth(
            allRows,
            timeZone,
            new Date(),
            focus
          )
        : null,
    [ready, allRows, timeZone, focus.year, focus.month]
  );

  const daySections = useMemo(
    () => groupTransactionsByDay(data, timeZone),
    [data, timeZone]
  );

  const dayNets = useMemo(
    () => dayNetsInMonth(data, focus, timeZone),
    [data, focus, timeZone]
  );

  const dayRows = useMemo(
    () => filterTransactionsForDay(data, focus, selectedDay, timeZone),
    [data, focus, selectedDay, timeZone]
  );

  const selectedDayHeading = useMemo(
    () => formatFocusDayHeading(focus, selectedDay, timeZone),
    [focus, selectedDay, timeZone]
  );

  const monthHasTransactions = data.length > 0;
  // Selection chrome only on the active center card.
  const showSelection = active && selectionMode;

  function renderRow(item: Transaction, index: number, total: number) {
    const first = index === 0;
    const last = index === total - 1;
    return (
      <View
        style={[
          styles.rowInCard,
          first && styles.rowInCardFirst,
          last && styles.rowInCardLast,
        ]}
      >
        <TransactionRow
          transaction={item}
          hideDate
          hideSeparator={last}
          pending={pendingIds.has(item.id)}
          categoryFix={categoryFixIds.has(item.id)}
          selectionMode={showSelection}
          selected={showSelection && selectedIds.has(item.id)}
          onPress={() => {
            if (!active) return;
            onRowPress(item);
          }}
          onLongPress={() => {
            if (!active) return;
            onRowLongPress(item.id);
          }}
        />
      </View>
    );
  }

  const sharedHeader = (
    <View>
      {upcoming ? (
        <UpcomingRepeatsBar
          summary={upcoming}
          onPress={() => {
            if (!active) return;
            router.push('/recurring');
          }}
        />
      ) : null}
      {monthHasTransactions && dateView === 'week' ? (
        <WeekDayStrip
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={
            active && onSelectedDayChange ? onSelectedDayChange : () => {}
          }
          currency={currency}
        />
      ) : null}
      {monthHasTransactions && dateView === 'month' ? (
        <MonthDayCalendar
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={
            active && onSelectedDayChange ? onSelectedDayChange : () => {}
          }
          currency={currency}
        />
      ) : null}
      {monthHasTransactions &&
      (dateView === 'week' || dateView === 'month') ? (
        <View style={styles.dayHeading}>
          <View style={styles.dayHeadingCopy}>
            <StrongText style={styles.dayHeadingText}>
              {selectedDayHeading}
            </StrongText>
            <CaptionText style={styles.dayHeadingMeta}>
              {dayRows.length === 1
                ? '1 transaction'
                : `${dayRows.length} transactions`}
            </CaptionText>
          </View>
          <DayNetAmount net={dayNets.get(selectedDay)} currency={currency} />
        </View>
      ) : null}
    </View>
  );

  const emptyMonth = (
    <TransactionsEmptyMonth periodLabel={period.navLabel} />
  );

  const emptyDay = (
    <View style={styles.emptyDayWrap}>
      <SurfaceCard padded style={styles.emptyDayCard}>
        <CaptionText style={styles.emptyBody}>
          No transactions this day. Tap + to add an expense or income.
        </CaptionText>
      </SurfaceCard>
    </View>
  );

  const emptyListBody =
    data.length === 0 ? (
      upcoming ? (
        <View style={styles.emptyBelowBar}>
          <CaptionText style={styles.emptyBody}>
            No transactions for today or earlier in {period.navLabel}. Upcoming
            repeats are listed above.
          </CaptionText>
        </View>
      ) : (
        emptyMonth
      )
    ) : undefined;

  // Pager keeps opacity 0 until the shared list is ready (blank → fill).
  if (!ready) {
    return <View style={styles.blank} />;
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <TitleText style={styles.emptyTitle}>
          Couldn’t load transactions
        </TitleText>
        <CaptionText style={styles.emptyBody}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </CaptionText>
        {active ? (
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={() => onRefetch()}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollEdgeHost edges={edges}>
      {dateView === 'list' ? (
        <SectionList
          sections={daySections}
          keyExtractor={(item) => item.id}
          {...scrollProps}
          stickySectionHeadersEnabled
          ListHeaderComponent={sharedHeader}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <StrongText style={styles.sectionHeaderText}>
                {section.title}
              </StrongText>
              <DayNetAmount
                net={netOfTransactions(section.data)}
                currency={currency}
              />
            </View>
          )}
          renderItem={({ item, index, section }) =>
            renderRow(item, index, section.data.length)
          }
          refreshing={active && isRefetching}
          onRefresh={active ? () => onRefetch() : undefined}
          contentContainerStyle={
            daySections.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={emptyListBody}
        />
      ) : (
        <FlatList
          data={dayRows}
          keyExtractor={(item) => item.id}
          {...scrollProps}
          ListHeaderComponent={sharedHeader}
          renderItem={({ item, index }) =>
            renderRow(item, index, dayRows.length)
          }
          refreshing={active && isRefetching}
          onRefresh={active ? () => onRefetch() : undefined}
          contentContainerStyle={
            dayRows.length === 0 && data.length === 0 && !upcoming
              ? styles.emptyList
              : styles.list
          }
          ListEmptyComponent={
            data.length === 0 && !upcoming
              ? emptyMonth
              : data.length === 0 && upcoming
                ? (
                    <View style={styles.emptyBelowBar}>
                      <CaptionText style={styles.emptyBody}>
                        No transactions for today or earlier in{' '}
                        {period.navLabel}. Upcoming repeats are listed above.
                      </CaptionText>
                    </View>
                  )
                : emptyDay
          }
        />
      )}
    </ScrollEdgeHost>
  );
}

function dayNetColor(tone: DayNetTone, colors: ThemeColors): string {
  if (tone === 'income') return colors.income;
  if (tone === 'expense') return colors.expense;
  return colors.inkMuted;
}

function DayNetAmount({
  net,
  currency,
}: {
  net: number | null | undefined;
  currency?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (net == null) return null;
  const label = formatDayNet(net, { currency });
  return (
    <StrongText
      style={[styles.dayNet, { color: dayNetColor(label.tone, colors) }]}
      accessibilityLabel={`Day net ${label.text}`}
    >
      {label.text}
    </StrongText>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  list: {
    paddingBottom: space.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  emptyBelowBar: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  emptyDayWrap: {
    paddingHorizontal: space.screen,
    paddingBottom: space.lg,
  },
  emptyDayCard: {
    alignItems: 'center',
  },
  rowInCard: {
    marginHorizontal: space.screen,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowInCardFirst: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  rowInCardLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    marginBottom: space.md,
  },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingBottom: 14,
  },
  dayHeadingCopy: {
    flexShrink: 1,
    gap: 4,
  },
  dayHeadingText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
  },
  dayHeadingMeta: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingVertical: space.sm,
  },
  sectionHeaderText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
  },
  dayNet: {
    ...typography.amount,
    fontSize: 13,
    lineHeight: 18,
  },
  blank: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  secondary: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
}

