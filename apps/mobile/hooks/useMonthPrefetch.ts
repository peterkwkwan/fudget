import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  isStatsMonthContentReady,
  prefetchTransactionList,
} from '@/lib/monthPrefetch';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import type { PeriodFocus } from '@/lib/periods';

/** Offline + flag: personal Stats from SQLite (mirrors usePersonalStats). */
function usePersonalStatsLocal(): boolean {
  const { online, ready } = useConnectivity();
  if (!OFFLINE_TXNS_ENABLED) return false;
  if (!ready) return true;
  return !online;
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
