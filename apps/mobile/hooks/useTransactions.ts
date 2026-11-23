import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { logOffline } from '@/lib/offline/log';
import { syncNow } from '@/lib/offline/syncEngine';
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
  // Local row is already saved. Refresh the badge immediately, then again
  // after the flush so a failed push can show the soft retry line.
  void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
  void syncNow(userId)
    .then((result) => {
      void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
      if (
        !result.skipped &&
        (result.pushed > 0 ||
          result.pulled > 0 ||
          result.dropped > 0 ||
          result.failed > 0)
      ) {
        invalidateTransactionsAndStats(queryClient);
      }
    })
    .catch(() => {
      logOffline('sync after write failed', { op: 'sync' });
      void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
    });
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
      // Later revisits: push then pull so a stuck outbox can clear.
      void syncNow(userId)
        .then((result) => {
          void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
          if (
            !result.skipped &&
            (result.pushed > 0 ||
              result.pulled > 0 ||
              result.dropped > 0 ||
              result.failed > 0)
          ) {
            invalidateTransactionsAndStats(queryClient);
          }
        })
        .catch(() => {
          logOffline('sync on transactions focus failed', { op: 'sync' });
          void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
        });
    }, [queryClient, userId])
  );

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
    return filterIndexedMonth(monthIndex, timeZone, monthFocus);
  }, [monthIndex, timeZone, monthFocus.year, monthFocus.month]);

  const upcoming = useMemo(() => {
    if (monthIndex == null) return null;
    const bucket = monthIndex.get(periodFocusMonthKey(monthFocus)) ?? [];
    return summarizeUpcomingRepeatsThisMonth(
      bucket,
      timeZone,
      new Date(),
      monthFocus
    );
  }, [monthIndex, timeZone, monthFocus.year, monthFocus.month]);

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
