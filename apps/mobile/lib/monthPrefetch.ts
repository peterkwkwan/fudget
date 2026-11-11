/**
 * Warm React Query caches for month swipe fill.
 * Adjacent months stay blank until focused — no ±N neighbor prefetch.
 */

import type { QueryClient } from '@tanstack/react-query';

import type { TransactionType } from '@/constants/categories';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { listLocalTransactions } from '@/lib/offline/transactionsRepo';
import {
  resolvePeriodBounds,
  resolveTrendBounds,
  trendBucketForPeriod,
  type PeriodFocus,
} from '@/lib/periods';
import {
  aggregateCategoryTotals,
  aggregatePeriodTotals,
  aggregateTrend,
  filterStatsTransactions,
} from '@/lib/statsLocal';
import {
  fetchAggregateCategoryTotals,
  fetchAggregateTotals,
  fetchAggregateTrend,
  fetchPersonalCategoryTotals,
  fetchPersonalTotals,
  fetchPersonalTrend,
  statsKeys,
  type StatsMetric,
} from '@/lib/stats';
import { isPeriodStatsReady } from '@/lib/statsCacheReady';
import { supabase } from '@/lib/supabase';
import {
  listTransactions,
  transactionKeys,
} from '@/lib/transactions';

const EMPTY_PERIOD_TOTALS = aggregatePeriodTotals([]);

export type PrefetchStatsMonthsArgs = {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  /** Offline SQLite personal path (matches usePersonalStats). */
  useLocal: boolean;
  userId?: string;
  /** Prefetch partner aggregate RPCs when Pair scope is live. */
  pairLive?: boolean;
  /**
   * When true with pairLive, only warm aggregate RPCs (no personal).
   * Used for adjacent Pair month swipe so we do not fire personal RPCs.
   */
  pairOnly?: boolean;
  /** Also warm personal trend for the settled month. */
  trendMetric?: StatsMetric;
};

async function localRows(userId: string | undefined) {
  if (!userId) return [];
  return listLocalTransactions(userId);
}

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

/** Ensure the shared transactions list is in cache (client filters by month). */
export function prefetchTransactionList(
  queryClient: QueryClient
): Promise<unknown> {
  return queryClient.prefetchQuery({
    queryKey: transactionKeys.list(),
    queryFn: OFFLINE_TXNS_ENABLED
      ? () => signedInUserId().then((userId) => listLocalTransactions(userId))
      : listTransactions,
  });
}

/** Prefetch personal (and optional pair) stats for one calendar month. */
export function prefetchStatsMonth(
  queryClient: QueryClient,
  args: Omit<PrefetchStatsMonthsArgs, 'focus'> & { focus: PeriodFocus }
): void {
  const {
    focus,
    timeZone,
    pieType,
    useLocal,
    userId,
    pairLive = false,
    pairOnly = false,
    trendMetric,
  } = args;
  const period = resolvePeriodBounds('month', timeZone, { focus });
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const source = useLocal ? 'local' : 'remote';
  const warmPersonal = !pairOnly;

  if (warmPersonal) {
    void queryClient.prefetchQuery({
      queryKey: [...statsKeys.totals(startIso, endIso), source, timeZone],
      queryFn: async () => {
        if (!useLocal) {
          return fetchPersonalTotals(period.start, period.end);
        }
        if (!userId) return EMPTY_PERIOD_TOTALS;
        const rows = await localRows(userId);
        return aggregatePeriodTotals(
          filterStatsTransactions(rows, period.start, period.end, timeZone)
        );
      },
    });

    void queryClient.prefetchQuery({
      queryKey: [
        ...statsKeys.category(pieType, startIso, endIso),
        source,
        timeZone,
      ],
      queryFn: async () => {
        if (!useLocal) {
          return fetchPersonalCategoryTotals(pieType, period.start, period.end);
        }
        if (!userId) return [];
        const rows = await localRows(userId);
        const scoped = filterStatsTransactions(
          rows,
          period.start,
          period.end,
          timeZone
        );
        return aggregateCategoryTotals(scoped, pieType);
      },
    });

    if (trendMetric && !(pairLive && !useLocal)) {
      const bucket = trendBucketForPeriod(
        period.start,
        period.end,
        period.preset
      );
      const trendBounds = resolveTrendBounds(period, timeZone);
      const trendStartIso = trendBounds.start.toISOString();
      const trendEndIso = trendBounds.end.toISOString();
      void queryClient.prefetchQuery({
        queryKey: [
          ...statsKeys.trend(
            trendMetric,
            trendStartIso,
            trendEndIso,
            bucket
          ),
          source,
          timeZone,
        ],
        queryFn: async () => {
          if (!useLocal) {
            return fetchPersonalTrend(
              trendMetric,
              trendBounds.start,
              trendBounds.end,
              bucket
            );
          }
          if (!userId) return [];
          const rows = await localRows(userId);
          const scoped = filterStatsTransactions(
            rows,
            trendBounds.start,
            trendBounds.end,
            timeZone
          );
          return aggregateTrend(scoped, trendMetric, bucket, timeZone);
        },
      });
    }
  }

  if (pairLive && !useLocal) {
    void queryClient.prefetchQuery({
      queryKey: statsKeys.aggregateTotals(startIso, endIso),
      queryFn: () => fetchAggregateTotals(period.start, period.end),
    });
    void queryClient.prefetchQuery({
      queryKey: statsKeys.aggregateCategory(pieType, startIso, endIso),
      queryFn: () =>
        fetchAggregateCategoryTotals(pieType, period.start, period.end),
    });
    if (trendMetric) {
      const bucket = trendBucketForPeriod(
        period.start,
        period.end,
        period.preset
      );
      const trendBounds = resolveTrendBounds(period, timeZone);
      void queryClient.prefetchQuery({
        queryKey: statsKeys.aggregateTrend(
          trendMetric,
          trendBounds.start.toISOString(),
          trendBounds.end.toISOString(),
          bucket
        ),
        queryFn: () =>
          fetchAggregateTrend(
            trendMetric,
            trendBounds.start,
            trendBounds.end,
            bucket
          ),
      });
    }
  }
}

/**
 * Personal settle is SQLite when useLocal: a loaded mirror (including zero
 * rows) paints Quiet month online and offline.
 * Remote-only path (flag off): empty mirror must not flash Quiet ahead of RPC.
 */
function localListCanPaint(
  queryClient: QueryClient,
  useLocal: boolean
): boolean {
  const rows = queryClient.getQueryData<unknown[]>(transactionKeys.list());
  if (!Array.isArray(rows)) return false;
  if (useLocal) return true;
  return rows.length > 0;
}

function personalPairCached(
  queryClient: QueryClient,
  source: 'local' | 'remote',
  pieType: TransactionType,
  startIso: string,
  endIso: string,
  timeZone: string
): boolean {
  return (
    queryClient.getQueryData([
      ...statsKeys.totals(startIso, endIso),
      source,
      timeZone,
    ]) != null &&
    queryClient.getQueryData([
      ...statsKeys.category(pieType, startIso, endIso),
      source,
      timeZone,
    ]) != null
  );
}

/**
 * Whether the focused Stats month can paint in one shot.
 * Ready when this period is already cached (local or remote query, or the
 * SQLite transaction list). Quiet empty counts as ready — zero txns.
 * A cache miss stays blank-then-fill until the loading placeholder's data arrives.
 */
export function isStatsMonthContentReady(
  queryClient: QueryClient,
  args: Omit<PrefetchStatsMonthsArgs, 'trendMetric'> & { focus: PeriodFocus }
): boolean {
  const {
    focus,
    timeZone,
    pieType,
    useLocal,
    pairLive = false,
  } = args;
  const period = resolvePeriodBounds('month', timeZone, { focus });
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const source = useLocal ? 'local' : 'remote';

  if (pairLive && !useLocal) {
    const totalsKey = statsKeys.aggregateTotals(startIso, endIso);
    const categoryKey = statsKeys.aggregateCategory(pieType, startIso, endIso);
    return isPeriodStatsReady({
      periodCached:
        queryClient.getQueryData(totalsKey) != null &&
        queryClient.getQueryData(categoryKey) != null,
      // Partner rows are never on the phone.
      localListCached: false,
      failed:
        queryClient.getQueryState(totalsKey)?.status === 'error' ||
        queryClient.getQueryState(categoryKey)?.status === 'error',
    });
  }

  const totalsKey = [
    ...statsKeys.totals(startIso, endIso),
    source,
    timeZone,
  ] as const;
  const categoryKey = [
    ...statsKeys.category(pieType, startIso, endIso),
    source,
    timeZone,
  ] as const;

  return isPeriodStatsReady({
    // Either source can paint. Switching online/offline must not blank a
    // period that is already on screen or in the SQLite list.
    periodCached:
      personalPairCached(
        queryClient,
        'local',
        pieType,
        startIso,
        endIso,
        timeZone
      ) ||
      personalPairCached(
        queryClient,
        'remote',
        pieType,
        startIso,
        endIso,
        timeZone
      ),
    localListCached: localListCanPaint(queryClient, useLocal),
    failed:
      queryClient.getQueryState(totalsKey)?.status === 'error' ||
      queryClient.getQueryState(categoryKey)?.status === 'error',
  });
}
