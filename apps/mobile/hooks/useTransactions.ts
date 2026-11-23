import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { localDateKey, startOfTomorrow } from '@/lib/dates';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { requestOfflineSync } from '@/lib/offline/syncRequest';
import { offlineUxKeys } from '@/lib/offline/ux';
import {
  bulkPatchLocalTransactions,
  createLocalTransaction,
  getLocalTransaction,
  listLocalTransactions,
  softDeleteLocalTransaction,
  softDeleteLocalTransactions,
  updateLocalTransaction,
} from '@/lib/offline/transactionsRepo';
import {
  currentPeriodFocus,
  type PeriodFocus,
} from '@/lib/periods';
import { deviceTimezone } from '@/lib/profile';
import { plannerVehicleKeys } from '@/lib/plannerVehicles';
import { statsKeys } from '@/lib/stats';
import {
  bulkPatchTransactions,
  createTransaction,
  filterIndexedMonth,
  getTransaction,
  indexTransactionsByLocalMonth,
  listTransactions,
  periodFocusMonthKey,
  softDeleteTransaction,
  softDeleteTransactions,
  summarizeUpcomingRepeatsThisMonth,
  transactionKeys,
  updateTransaction,
  type Transaction,
  type TransactionBulkPatch,
  type TransactionInput,
} from '@/lib/transactions';

/**
 * Local civil day key that ticks at midnight and on foreground return so
 * recurring visibility / upcoming do not stay stuck on yesterday’s “today”.
 */
function useLocalTodayKey(timeZone: string): string {
  const [todayKey, setTodayKey] = useState(() =>
    localDateKey(new Date(), timeZone)
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      const now = new Date();
      const next = localDateKey(now, timeZone);
      setTodayKey((prev) => (prev === next ? prev : next));
      if (timer != null) clearTimeout(timer);
      const delay = Math.max(
        1_000,
        startOfTomorrow(timeZone, now).getTime() - Date.now() + 50
      );
      timer = setTimeout(refresh, delay);
    };

    refresh();
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      if (timer != null) clearTimeout(timer);
      sub.remove();
    };
  }, [timeZone]);

  return todayKey;
}

function invalidateTransactionsAndStats(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
  // Linked txns adjust Planner account balances.
  void queryClient.invalidateQueries({ queryKey: plannerVehicleKeys.all });
}

/** Online path only invalidates. Flag on: also push then pull. */
function settleTransactionWrite(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined
) {
  invalidateTransactionsAndStats(queryClient);
  if (!OFFLINE_TXNS_ENABLED || !userId) return;
  // Local row is already saved. Kick the shared foreground drain so a failed
  // flush arms the 10s retry (a one-shot syncNow here used to leave the
  // “Saved on phone” banner stuck with no timer).
  void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
  requestOfflineSync();
}

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('You must be signed in to change a transaction.');
  return userId;
}

/**
 * Active transactions from Supabase, then client-split for the focused month:
 * - list: one-offs + recurring on/before local today, within focused month
 * - upcoming: recurring after today within the focused calendar month
 */
export function useTransactionList(focus?: PeriodFocus) {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const userId = user?.id;
  const timeZone = profile?.timezone || deviceTimezone();
  const monthFocus = focus ?? currentPeriodFocus(timeZone);
  // Root useOfflineTransactionSync owns the cold-start sync. Skip the first
  // focus kick so we do not queue a second push/pull against the same DB.
  const skipFirstFocusSync = useRef(true);

  const query = useQuery({
    queryKey: transactionKeys.list(),
    // Flag off: same stable listTransactions reference as the online path.
    queryFn: OFFLINE_TXNS_ENABLED
      ? () => listLocalTransactions(requireUserId(userId))
      : listTransactions,
    enabled: OFFLINE_TXNS_ENABLED ? Boolean(userId) : true,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.list() });
      if (!OFFLINE_TXNS_ENABLED || !userId) return;
      void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
      if (skipFirstFocusSync.current) {
        skipFirstFocusSync.current = false;
        return;
      }
      // Later revisits: shared drain so a stuck outbox can clear (and arms retry).
      requestOfflineSync();
    }, [queryClient, userId])
  );

  // Civil “today” for recurring visibility — refreshes at midnight / foreground.
  const todayKey = useLocalTodayKey(timeZone);

  // Index once per list/timezone; month swipe only looks up a bucket.
  const monthIndex = useMemo(
    () =>
      query.data != null
        ? indexTransactionsByLocalMonth(query.data, timeZone)
        : null,
    [query.data, timeZone]
  );

  const visible = useMemo(() => {
    if (monthIndex == null) return undefined;
    // todayKey is the memo gate; new Date() is read when it changes.
    void todayKey;
    return filterIndexedMonth(monthIndex, timeZone, monthFocus, new Date());
  }, [monthIndex, timeZone, monthFocus.year, monthFocus.month, todayKey]);

  const upcoming = useMemo(() => {
    if (monthIndex == null) return null;
    void todayKey;
    const bucket = monthIndex.get(periodFocusMonthKey(monthFocus)) ?? [];
    return summarizeUpcomingRepeatsThisMonth(
      bucket,
      timeZone,
      new Date(),
      monthFocus
    );
  }, [monthIndex, timeZone, monthFocus.year, monthFocus.month, todayKey]);

  return {
    ...query,
    /** Focused-month rows; undefined until the shared list has loaded. */
    data: visible,
    allRows: query.data,
    upcoming,
    timeZone,
    focus: monthFocus,
  };
}

export function useTransaction(id: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: transactionKeys.detail(id ?? ''),
    queryFn: () =>
      OFFLINE_TXNS_ENABLED
        ? getLocalTransaction(requireUserId(userId), id!)
        : getTransaction(id!),
    enabled: Boolean(id) && (OFFLINE_TXNS_ENABLED ? Boolean(userId) : true),
  });
}

export function useCreateTransaction() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => {
      const userId = requireUserId(user?.id);
      if (OFFLINE_TXNS_ENABLED) {
        return createLocalTransaction(
          userId,
          input,
          profile?.currency ?? 'HKD'
        );
      }
      return createTransaction(
        userId,
        input,
        profile?.currency ?? 'HKD'
      );
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient, user?.id);
    },
  });
}

export function useUpdateTransaction(id: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => {
      if (OFFLINE_TXNS_ENABLED) {
        return updateLocalTransaction(requireUserId(user?.id), id, input);
      }
      return updateTransaction(id, input);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient, user?.id);
    },
  });
}

export function useSoftDeleteTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (txnId: string) => {
      if (OFFLINE_TXNS_ENABLED) {
        return softDeleteLocalTransaction(requireUserId(user?.id), txnId);
      }
      return softDeleteTransaction(txnId);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient, user?.id);
    },
  });
}

export function useBulkSoftDeleteTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => {
      if (OFFLINE_TXNS_ENABLED) {
        return softDeleteLocalTransactions(requireUserId(user?.id), ids);
      }
      return softDeleteTransactions(ids);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient, user?.id);
    },
  });
}

export function useBulkPatchTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rows,
      patch,
    }: {
      rows: Transaction[];
      patch: TransactionBulkPatch;
    }) => {
      if (OFFLINE_TXNS_ENABLED) {
        return bulkPatchLocalTransactions(
          requireUserId(user?.id),
          rows,
          patch
        );
      }
      return bulkPatchTransactions(rows, patch);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient, user?.id);
    },
  });
}
