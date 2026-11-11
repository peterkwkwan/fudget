import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  isStatsMonthContentReady,
  prefetchStatsMonth,
  prefetchTransactionList,
} from '@/lib/monthPrefetch';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { adjacentMonthFocuses } from '@/lib/monthSwipe';
import type { PeriodFocus } from '@/lib/periods';
import type { StatsMetric } from '@/lib/stats';

/**
 * Flag on: personal Stats settle from SQLite online and offline
 * (matches usePersonalStats).
 */
function usePersonalStatsLocal(): boolean {
  return OFFLINE_TXNS_ENABLED;
}

/**
 * True when the focused Stats month’s totals + categories are cached so the
 * body can fill in one shot. Re-subscribes until ready; latest focus wins.
 */
export function useStatsMonthContentReady(args: {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  pairLive: boolean;
  enabled: boolean;
}): boolean {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const useLocal = usePersonalStatsLocal();
  const { focus, timeZone, pieType, pairLive, enabled } = args;
  const [cacheEpoch, setCacheEpoch] = useState(0);

  const ready =
    !enabled ||
    isStatsMonthContentReady(queryClient, {
      focus,
      timeZone,
      pieType,
      useLocal,
      userId: user?.id,
      pairLive,
    });

  useEffect(() => {
    if (!enabled || ready) return;
    // QueryCache#notify can run during a child useQuery render. Defer setState.
    let cancelled = false;
    let scheduled = false;
    const unsub = queryClient.getQueryCache().subscribe(() => {
      if (scheduled || cancelled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (cancelled) return;
        setCacheEpoch((n) => n + 1);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [queryClient, enabled, ready, focus.year, focus.month, pieType, pairLive]);

  // cacheEpoch forces a re-read of the query cache after updates.
  void cacheEpoch;
  return ready;
}

/**
 * Keep the shared transactions list warm. Month bodies filter client-side.
 */
export function usePrefetchTransactionMonths(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    void prefetchTransactionList(queryClient);
  }, [queryClient, enabled]);
}

/**
 * Pair only: warm prev/next aggregate months so a swipe can paint from cache.
 * Personal months do not need this when the shared list is warm.
 * Never mirrors partner rows — aggregate RPCs only.
 */
export function usePrefetchAdjacentPairStats(args: {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  pairLive: boolean;
  trendMetric?: StatsMetric;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const { online, ready } = useConnectivity();
  const {
    focus,
    timeZone,
    pieType,
    pairLive,
    trendMetric,
    enabled,
  } = args;

  useEffect(() => {
    if (!enabled || !pairLive || !ready || !online) return;
    const { prev, next } = adjacentMonthFocuses(focus);
    for (const adj of [prev, next]) {
      prefetchStatsMonth(queryClient, {
        focus: adj,
        timeZone,
        pieType,
        useLocal: false,
        pairLive: true,
        pairOnly: true,
        trendMetric,
      });
    }
  }, [
    queryClient,
    enabled,
    pairLive,
    ready,
    online,
    focus.year,
    focus.month,
    timeZone,
    pieType,
    trendMetric,
  ]);
}
