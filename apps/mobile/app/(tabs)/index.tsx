import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  BulkEditSheet,
  type BulkEditField,
} from '@/components/BulkEditSheet';
import {
  MonthCardPager,
  type MonthCardPagerHandle,
} from '@/components/MonthCardPager';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { StrongText } from '@/components/StyledText';
import { TransactionsMonthBody } from '@/components/TransactionsMonthBody';
import { TxnSelectionHeader } from '@/components/TxnSelectionHeader';
import { radius, space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeProvider';
import { usePrefetchTransactionMonths } from '@/hooks/useMonthPrefetch';
import {
  useBulkPatchTransactions,
  useBulkSoftDeleteTransactions,
  useTransactionList,
} from '@/hooks/useTransactions';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { setCalendarAddDate } from '@/lib/addTransactionDate';
import { useAuth } from '@/lib/auth';
import { userFacingOfflineWriteError } from '@/lib/offline/writeError';
import { PeriodNavHeader } from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  shiftPeriodFocus,
  type PeriodFocus,
} from '@/lib/periods';
import { parseTransactionsDateView } from '@/lib/profile';
import {
  clampDayInMonth,
  dateKeyFromFocusDay,
  defaultSelectedDay,
  filterTransactionsForDay,
} from '@/lib/transactionsDateView';
import { filterTransactionsForMonth } from '@/lib/transactionModel';
import type { Transaction } from '@/lib/transactions';
import { zonedYmd } from '@/lib/dates';

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || 'UTC';
  const currency = profile?.currency ?? 'HKD';
  // Layout mode is chosen in Account → Settings; honor the saved profile value.
  const dateView = parseTransactionsDateView(profile?.transactions_date_view);

  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    defaultSelectedDay(currentPeriodFocus(timeZone), timeZone)
  );

  // Pager owns swipe motion; navbar label updates only after focus settles.
  const pagerRef = useRef<MonthCardPagerHandle>(null);

  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus]
  );

  const {
    allRows,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTransactionList(focus);

  // Shared list feeds the focused month; keep it warm.
  usePrefetchTransactionMonths(true);

  const contentReady = !isLoading && allRows != null;

  const bulkDelete = useBulkSoftDeleteTransactions();
  const bulkPatch = useBulkPatchTransactions();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkEditField | null>(null);

  const busy = bulkDelete.isPending || bulkPatch.isPending;
  const { pendingIds, categoryFixIds, banner } = useOfflineGates();

  // Week and month have a selected day. List and other tabs add on today.
  useEffect(() => {
    if (dateView === 'list') {
      setCalendarAddDate(null);
    } else {
      setCalendarAddDate(dateKeyFromFocusDay(focus, selectedDay));
    }
    return () => setCalendarAddDate(null);
  }, [dateView, focus.year, focus.month, selectedDay]);

  // Clamp before paint so settle matches the projected day for the new month.
  useLayoutEffect(() => {
    setSelectedDay((prev) => {
      const today = zonedYmd(new Date(), timeZone);
      if (today.year === focus.year && today.month === focus.month) {
        return today.day;
      }
      return clampDayInMonth(focus.year, focus.month, prev);
    });
  }, [focus.year, focus.month, timeZone]);

  const monthRows = useMemo(
    () =>
      allRows != null
        ? filterTransactionsForMonth(allRows, timeZone, focus)
        : [],
    [allRows, timeZone, focus.year, focus.month]
  );

  const dayRows = useMemo(
    () => filterTransactionsForDay(monthRows, focus, selectedDay, timeZone),
    [monthRows, focus, selectedDay, timeZone]
  );

  const listForSelection = dateView === 'list' ? monthRows : dayRows;

  const selectedRows = useMemo(() => {
    return listForSelection.filter((t) => selectedIds.has(t.id));
  }, [listForSelection, selectedIds]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setOverflowOpen(false);
    setBulkField(null);
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
    setOverflowOpen(false);
    setBulkField(null);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      exitSelection();
    }
  }, [selectionMode, selectedIds, exitSelection]);

  // Drop ids that left the visible list (e.g. after delete / period change).
  useEffect(() => {
    if (!selectionMode) return;
    const visible = new Set(listForSelection.map((t) => t.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [listForSelection, selectionMode]);

  const confirmDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const countLabel =
      ids.length === 1 ? '1 transaction' : `${ids.length} transactions`;
    Alert.alert(
      'Delete selected?',
      `${countLabel} will be hidden from Transactions (soft-delete). They are not permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void bulkDelete.mutateAsync(ids).then(
              () => exitSelection(),
              (err: unknown) => {
                Alert.alert(
                  'Could not delete',
                  userFacingOfflineWriteError(err, 'Something went wrong.')
                );
              }
            );
          },
        },
      ]
    );
  }, [selectedIds, bulkDelete, exitSelection]);

  const openBulk = useCallback((field: BulkEditField) => {
    setOverflowOpen(false);
    setBulkField(field);
  }, []);

  const applyBulk = useCallback(
    (patch: {
      occurred_at?: string;
      category?: string;
      note?: string | null;
    }) => {
      const rows = selectedRows;
      if (rows.length === 0) return;
      void bulkPatch.mutateAsync({ rows, patch }).then(
        () => exitSelection(),
        (err: unknown) => {
          Alert.alert(
            'Could not update',
            userFacingOfflineWriteError(err, 'Something went wrong.')
          );
        }
      );
    },
    [selectedRows, bulkPatch, exitSelection]
  );

  const onSwipeStep = useCallback((delta: -1 | 1) => {
    pagerRef.current?.step(delta);
  }, []);

  const onRowPress = useCallback(
    (item: Transaction) => {
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }
      router.push(`/transaction/${item.id}`);
    },
    [selectionMode, toggleSelection, router]
  );

  const onRowLongPress = useCallback(
    (id: string) => {
      if (!selectionMode) enterSelection(id);
    },
    [selectionMode, enterSelection]
  );

  const onMonthStep = useCallback((delta: -1 | 1) => {
    setFocus((current) => shiftPeriodFocus(current, 'month', delta));
  }, []);

  const onRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderPage = useCallback(
    (pageFocus: PeriodFocus) => (
      <TransactionsMonthBody
        focus={pageFocus}
        allRows={allRows}
        listLoading={isLoading}
        isError={isError}
        error={error}
        isRefetching={isRefetching}
        onRefetch={onRefetch}
        timeZone={timeZone}
        dateView={dateView}
        currency={currency}
        pendingIds={pendingIds}
        categoryFixIds={categoryFixIds}
        active
        selectedDay={selectedDay}
        onSelectedDayChange={setSelectedDay}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onRowPress={onRowPress}
        onRowLongPress={onRowLongPress}
      />
    ),
    [
      allRows,
      isLoading,
      isError,
      error,
      isRefetching,
      onRefetch,
      timeZone,
      dateView,
      currency,
      pendingIds,
      categoryFixIds,
      selectedDay,
      selectionMode,
      selectedIds,
      onRowPress,
      onRowLongPress,
    ]
  );

  return (
    <View style={styles.container}>
      {selectionMode ? (
        <TxnSelectionHeader
          count={selectedIds.size}
          busy={busy}
          onCancel={exitSelection}
          onDelete={confirmDelete}
          onOverflow={() => setOverflowOpen(true)}
        />
      ) : (
        <PeriodNavHeader>
          <PeriodSelector
            preset="month"
            navLabel={period.navLabel}
            focus={focus}
            timeZone={timeZone}
            showModeMenu={false}
            pageTitle="Transactions"
            onSwipeStep={onSwipeStep}
            onFocusChange={setFocus}
          />
        </PeriodNavHeader>
      )}

      <OfflineBanner message={banner} />
      <MonthCardPager
        ref={pagerRef}
        focus={focus}
        enabled={!selectionMode}
        onStep={onMonthStep}
        renderPage={renderPage}
        contentReady={contentReady}
      />

      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setOverflowOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
        >
          <Pressable style={styles.menuSheet} accessibilityRole="menu">
            {(
              [
                { field: 'date' as const, label: 'Edit dates' },
                { field: 'category' as const, label: 'Edit categories' },
                { field: 'note' as const, label: 'Edit notes' },
              ] as const
            ).map((item, index, arr) => (
              <Pressable
                key={item.field}
                style={({ pressed }) => [
                  styles.menuItem,
                  index === arr.length - 1 && styles.menuItemLast,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => openBulk(item.field)}
                accessibilityRole="menuitem"
              >
                <StrongText style={styles.menuItemText}>{item.label}</StrongText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <BulkEditSheet
        visible={bulkField != null}
        field={bulkField}
        rows={selectedRows}
        busy={bulkPatch.isPending}
        onCancel={() => setBulkField(null)}
        onApply={applyBulk}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 88,
    paddingRight: space.md,
  },
  menuSheet: {
    minWidth: 200,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuItemText: {
    color: colors.ink,
  },
});
}

