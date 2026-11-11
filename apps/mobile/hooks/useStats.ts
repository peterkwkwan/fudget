import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { listLocalTransactions } from '@/lib/offline/transactionsRepo';
import type { PeriodBounds, TrendBucket, TrendSlot } from '@/lib/periods';
import {
  alignCenteredTrendSlots,
  focusFromPeriodBounds,
  resolveTrendBounds,
  trendBucketForPeriod,
} from '@/lib/periods';
import { deviceTimezone } from '@/lib/profile';
import {
  fetchAggregateCategoryTotals,
  fetchAggregateTotals,
  fetchAggregateTrend,
  fetchPartnerCategoryTotal,
  fetchPersonalCategoryTotals,
  fetchPersonalTotals,
  fetchPersonalTrend,
  listCategoryTransactions,
  statsKeys,
  type CategoryTotal,
  type PeriodTotals,
  type StatsMetric,
  type TrendPoint,
} from '@/lib/stats';
import {
  aggregateCategoryTotals,
  aggregatePeriodTotals,
  aggregateTrend,
  filterCategoryTransactions,
  filterStatsTransactions,
} from '@/lib/statsLocal';
import type { Transaction } from '@/lib/transactionModel';
import { transactionKeys } from '@/lib/transactions';

export type StatsScope = 'personal' | 'pair';

/** Empty mirror / no user yet — never leave personal Stats spinning. */
const EMPTY_PERIOD_TOTALS = aggregatePeriodTotals([]);

/**
 * Rows that can paint this period immediately.
 * Local settle (flag on): a loaded empty mirror is a real Quiet month,
 * online and offline.
 * Remote-only (flag off): an empty mirror must not flash Quiet ahead of RPC.
 * When this is missing, callers fall back to the other source's period
 * so online/offline doesn't blank stats that are already on screen.
 */
function cachedListRows(
  queryClient: QueryClient,
  useLocal: boolean
): Transaction[] | undefined {
  const rows = queryClient.getQueryData<Transaction[]>(transactionKeys.list());
  if (rows == null) return undefined;
  if (!useLocal && rows.length === 0) return undefined;
  return rows;
}

function previewPersonalStats(
  queryClient: QueryClient,
  args: {
    useLocal: boolean;
    pieType: TransactionType;
    start: Date;
    end: Date;
    startIso: string;
    endIso: string;
    timeZone: string;
  }
): { totals: PeriodTotals; categories: CategoryTotal[] } | null {
  const rows = cachedListRows(queryClient, args.useLocal);
  if (rows) {
    const scoped = filterStatsTransactions(
      rows,
      args.start,
      args.end,
      args.timeZone
    );
    return {
      totals: aggregatePeriodTotals(scoped),
      categories: aggregateCategoryTotals(scoped, args.pieType),
    };
  }
  const other = args.useLocal ? 'remote' : 'local';
  const totals = queryClient.getQueryData<PeriodTotals>([
    ...statsKeys.totals(args.startIso, args.endIso),
    other,
    args.timeZone,
  ]);
  const categories = queryClient.getQueryData<CategoryTotal[]>([
    ...statsKeys.category(args.pieType, args.startIso, args.endIso),
    other,
    args.timeZone,
  ]);
  if (totals == null || categories == null) return null;
  return { totals, categories };
}

function previewPersonalTrend(
  queryClient: QueryClient,
  args: {
    useLocal: boolean;
    metric: StatsMetric;
    bucket: TrendBucket;
    start: Date;
    end: Date;
    startIso: string;
    endIso: string;
    timeZone: string;
  }
): TrendPoint[] | undefined {
  const rows = cachedListRows(queryClient, args.useLocal);
  if (rows) {
    const scoped = filterStatsTransactions(
      rows,
      args.start,
      args.end,
      args.timeZone
    );
    return aggregateTrend(scoped, args.metric, args.bucket, args.timeZone);
  }
  const other = args.useLocal ? 'remote' : 'local';
  return queryClient.getQueryData<TrendPoint[]>([
    ...statsKeys.trend(args.metric, args.startIso, args.endIso, args.bucket),
    other,
    args.timeZone,
  ]);
}

/**
 * Flag on: personal Stats always settle from the SQLite mirror (online and
 * offline). Remote personal RPCs run on tab focus / pull-to-refresh only.
 * Flag off: remote RPCs remain the queryFn.
 * Until NetInfo's first snapshot with the flag off path, prefer not hanging.
 */
function usePersonalStatsLocal(): boolean {
  if (OFFLINE_TXNS_ENABLED) return true;
  return false;
}

/** Warm remote personal keys without swapping the on-screen local settle. */
function prefetchRemotePersonalStats(
  queryClient: QueryClient,
  args: {
    period: PeriodBounds;
    pieType: TransactionType;
    timeZone: string;
    metric?: StatsMetric;
    bucket?: TrendBucket;
  }
) {
  const startIso = args.period.start.toISOString();
  const endIso = args.period.end.toISOString();
  void queryClient.prefetchQuery({
    queryKey: [...statsKeys.totals(startIso, endIso), 'remote', args.timeZone],
    queryFn: () => fetchPersonalTotals(args.period.start, args.period.end),
    staleTime: 0,
  });
  void queryClient.prefetchQuery({
    queryKey: [
      ...statsKeys.category(args.pieType, startIso, endIso),
      'remote',
      args.timeZone,
    ],
    queryFn: () =>
      fetchPersonalCategoryTotals(
        args.pieType,
        args.period.start,
        args.period.end
      ),
    staleTime: 0,
  });
  if (args.metric && args.bucket) {
    const trendBounds = resolveTrendBounds(args.period, args.timeZone);
    void queryClient.prefetchQuery({
      queryKey: [
        ...statsKeys.trend(
          args.metric,
          trendBounds.start.toISOString(),
          trendBounds.end.toISOString(),
          args.bucket
        ),
        'remote',
        args.timeZone,
      ],
      queryFn: () =>
        fetchPersonalTrend(
          args.metric!,
          trendBounds.start,
          trendBounds.end,
          args.bucket!
        ),
      staleTime: 0,
    });
  }
}

export function usePersonalStats(
  period: PeriodBounds,
  pieType: TransactionType,
  /** Idle while Pair is live so Pair month changes do not fire personal work. */
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const { online, ready: netReady } = useConnectivity();
  const timeZone = profile?.timezone || deviceTimezone();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const bucket: TrendBucket = trendBucketForPeriod(
    period.start,
    period.end,
    period.preset
  );
  const source = useLocal ? 'local' : 'remote';
  // Local path needs the in-memory auth user — avoid getSession network refresh.
  const localReady = Boolean(userId);
  const queryEnabled = enabled && (useLocal ? localReady : true);
  const listUpdatedAt =
    queryClient.getQueryState(transactionKeys.list())?.dataUpdatedAt ?? 0;
  const cachedPreview = useMemo(
    () =>
      previewPersonalStats(queryClient, {
        useLocal,
        pieType,
        start: period.start,
        end: period.end,
        startIso,
        endIso,
        timeZone,
      }),
    [queryClient, useLocal, pieType, startIso, endIso, timeZone, listUpdatedAt]
  );

  const totalsKey = [...statsKeys.totals(startIso, endIso), source, timeZone];

  const totals = useQuery({
    queryKey: totalsKey,
    placeholderData: cachedPreview?.totals,
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalTotals(period.start, period.end);
      }
      if (!userId) return EMPTY_PERIOD_TOTALS;
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(
        rows,
        period.start,
        period.end,
        timeZone
      );
      return aggregatePeriodTotals(scoped);
    },
    enabled: queryEnabled,
  });

  const categories = useQuery({
    queryKey: [...statsKeys.category(pieType, startIso, endIso), source, timeZone],
    placeholderData: cachedPreview?.categories,
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalCategoryTotals(pieType, period.start, period.end);
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(
        rows,
        period.start,
        period.end,
        timeZone
      );
      return aggregateCategoryTotals(scoped, pieType);
    },
    enabled: queryEnabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (!useLocal) {
        void queryClient.invalidateQueries({ queryKey: statsKeys.personal() });
        return;
      }
      // Local settle: only re-read SQLite when the shared list is newer.
      // Avoid a full personal invalidate on every Stats focus when fresh.
      const listAt =
        queryClient.getQueryState(transactionKeys.list())?.dataUpdatedAt ?? 0;
      const totalsAt =
        queryClient.getQueryState(totalsKey)?.dataUpdatedAt ?? 0;
      if (listAt > totalsAt) {
        void queryClient.invalidateQueries({ queryKey: statsKeys.personal() });
      }
      // Personal RPCs on tab focus only (not on every month swipe).
      if (netReady && online) {
        prefetchRemotePersonalStats(queryClient, {
          period,
          pieType,
          timeZone,
        });
      }
    }, [
      enabled,
      useLocal,
      queryClient,
      netReady,
      online,
      period,
      pieType,
      timeZone,
      startIso,
      endIso,
      source,
    ])
  );

  const refreshRemote = useCallback(() => {
    if (!enabled || !useLocal) return;
    if (!(netReady && online)) return;
    prefetchRemotePersonalStats(queryClient, {
      period,
      pieType,
      timeZone,
    });
  }, [
    enabled,
    useLocal,
    netReady,
    online,
    queryClient,
    period,
    pieType,
    timeZone,
  ]);

  return {
    totals,
    categories,
    bucket,
    startIso,
    endIso,
    useLocal,
    refreshRemote,
  };
}

/**
 * Pair aggregate stats. Only enable when actively linked.
 * Never fetches partner transaction rows — RPCs return sums/counts only.
 * Always online — callers must disable while offline.
 */
export function useAggregateStats(
  period: PeriodBounds,
  pieType: TransactionType,
  enabled: boolean
) {
  const queryClient = useQueryClient();
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const totals = useQuery({
    queryKey: statsKeys.aggregateTotals(startIso, endIso),
    queryFn: () => fetchAggregateTotals(period.start, period.end),
    enabled,
  });

  const categories = useQuery({
    queryKey: statsKeys.aggregateCategory(pieType, startIso, endIso),
    queryFn: () =>
      fetchAggregateCategoryTotals(pieType, period.start, period.end),
    enabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void queryClient.invalidateQueries({ queryKey: statsKeys.aggregate() });
    }, [queryClient, enabled])
  );

  return { totals, categories, startIso, endIso };
}

function alignTrendSlots(
  period: PeriodBounds,
  timeZone: string,
  raw: { bucketStart: string; total: number }[]
): TrendSlot[] {
  if (period.preset === 'custom') {
    return raw.map((p) => ({
      bucketStart: p.bucketStart,
      total: p.total,
    }));
  }
  const focus = focusFromPeriodBounds(period, timeZone);
  return alignCenteredTrendSlots(focus, period.preset, timeZone, raw);
}

export function usePersonalTrend(
  period: PeriodBounds,
  metric: StatsMetric,
  bucket: TrendBucket,
  timeZone: string = 'UTC',
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  // Centered ±2 window for Monthly/Yearly; custom Period uses the range as-is.
  const { start, end } = resolveTrendBounds(period, timeZone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const source = useLocal ? 'local' : 'remote';
  const queryEnabled = enabled && (useLocal ? Boolean(userId) : true);
  const listUpdatedAt =
    queryClient.getQueryState(transactionKeys.list())?.dataUpdatedAt ?? 0;
  const cachedTrend = useMemo(
    () =>
      queryEnabled
        ? previewPersonalTrend(queryClient, {
            useLocal,
            metric,
            bucket,
            start,
            end,
            startIso,
            endIso,
            timeZone,
          })
        : undefined,
    [
      queryClient,
      queryEnabled,
      useLocal,
      metric,
      bucket,
      startIso,
      endIso,
      timeZone,
      listUpdatedAt,
    ]
  );

  return useQuery({
    queryKey: [...statsKeys.trend(metric, startIso, endIso, bucket), source, timeZone],
    placeholderData: cachedTrend,
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalTrend(metric, start, end, bucket);
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(rows, start, end, timeZone);
      return aggregateTrend(scoped, metric, bucket, timeZone);
    },
    enabled: queryEnabled,
    select: (raw): TrendSlot[] => alignTrendSlots(period, timeZone, raw),
  });
}

/**
 * Pair aggregate trend. Same centered window / slot alignment as personal.
 * Online-only — callers disable while offline / unpaired.
 * Focus invalidation is covered by `useAggregateStats` (`statsKeys.aggregate()`).
 */
export function useAggregateTrend(
  period: PeriodBounds,
  metric: StatsMetric,
  bucket: TrendBucket,
  timeZone: string = 'UTC',
  enabled: boolean = true
) {
  const { start, end } = resolveTrendBounds(period, timeZone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  return useQuery({
    queryKey: statsKeys.aggregateTrend(metric, startIso, endIso, bucket),
    queryFn: () => fetchAggregateTrend(metric, start, end, bucket),
    enabled,
    select: (raw): TrendSlot[] => alignTrendSlots(period, timeZone, raw),
  });
}

/**
 * Partner category total for Pair drill-down. Online only — callers
 * disable while offline or unpaired. Returns sum and count, never rows.
 */
export function usePartnerCategoryTotal(params: {
  type: TransactionType;
  category: string;
  start: Date;
  end: Date;
  enabled?: boolean;
}) {
  const startIso = Number.isNaN(params.start.getTime())
    ? ''
    : params.start.toISOString();
  const endIso = Number.isNaN(params.end.getTime())
    ? ''
    : params.end.toISOString();

  return useQuery({
    queryKey: statsKeys.partnerCategory(
      params.type,
      params.category,
      startIso,
      endIso
    ),
    queryFn: () =>
      fetchPartnerCategoryTotal({
        type: params.type,
        category: params.category,
        start: params.start,
        end: params.end,
      }),
    enabled: params.enabled !== false && Boolean(params.category),
  });
}

export function useCategoryDrilldown(params: {
  type: TransactionType;
  category: string;
  start: Date;
  end: Date;
  enabled?: boolean;
}) {
  const { profile, user } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  const startIso = params.start.toISOString();
  const endIso = params.end.toISOString();
  const source = useLocal ? 'local' : 'remote';

  return useQuery({
    queryKey: [
      ...statsKeys.drilldown(
        params.type,
        params.category,
        startIso,
        endIso,
        timeZone
      ),
      source,
    ],
    queryFn: async () => {
      if (!useLocal) {
        return listCategoryTransactions({
          type: params.type,
          category: params.category,
          start: params.start,
          end: params.end,
          timeZone,
        });
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      return filterCategoryTransactions(rows, {
        type: params.type,
        category: params.category,
        start: params.start,
        end: params.end,
        timeZone,
      });
    },
    enabled:
      params.enabled !== false &&
      Boolean(params.category) &&
      (useLocal ? Boolean(userId) : true),
  });
}
