import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { logOffline } from '@/lib/offline/log';
import { subscribeConnectivity } from '@/lib/offline/net';
import {
  shouldDrainOnConnectivity,
  shouldRetrySync,
} from '@/lib/offline/netState';
import { syncNow } from '@/lib/offline/syncEngine';
import { offlineUxKeys } from '@/lib/offline/ux';
import { transactionKeys } from '@/lib/transactions';

/** Retry a failed flush while the app stays foreground (plan: drain when online). */
const RETRY_MS = 10_000;

/**
 * Foreground and reconnect sync. No-op while OFFLINE_TXNS_ENABLED is false,
 * so NetInfo is not subscribed and the device DB is not opened.
 *
 * Also retries on a timer after a failed or skipped push so “Saved on phone —
 * sync will retry” does not stick while the phone stays online. The drain
 * trusts the connectivity listener when that listener says the link is up,
 * because `NetInfo.fetch()` can still report offline and cancel the timer.
 */
export function useOfflineTransactionSync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!OFFLINE_TXNS_ENABLED || !userId) return;

    let cancelled = false;
    let inFlight = false;
    let again = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    /** null until the first connectivity snapshot. */
    let listenerOnline: boolean | null = null;
    let unsubNet = () => {};

    const clearRetry = () => {
      if (retryTimer == null) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer != null) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!cancelled) run();
      }, RETRY_MS);
    };

    const run = () => {
      if (cancelled) return;
      if (inFlight) {
        again = true;
        return;
      }
      clearRetry();
      inFlight = true;
      // Listener already says the radio is up. Do not ask fetch() again —
      // a stale offline answer skips the drain and leaves the failure banner up.
      const trustLink = listenerOnline === true;
      void syncNow(userId, trustLink ? { isOnline: async () => true } : undefined)
        .then((result) => {
          if (cancelled) return;
          void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
          if (
            !result.skipped &&
            (result.pushed > 0 ||
              result.pulled > 0 ||
              result.dropped > 0 ||
              result.failed > 0)
          ) {
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          }
          if (result.failed > 0) {
            logOffline('sync push failed', { op: 'push' });
          }
          if (
            shouldRetrySync({
              skipped: result.skipped,
              failed: result.failed,
              listenerOnline,
            })
          ) {
            scheduleRetry();
          }
        })
        .catch(() => {
          logOffline('sync failed', { op: 'sync' });
          if (!cancelled) {
            void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
            if (
              shouldRetrySync({
                skipped: false,
                failed: 1,
                listenerOnline,
              })
            ) {
              scheduleRetry();
            }
          }
        })
        .finally(() => {
          inFlight = false;
          if (again && !cancelled) {
            again = false;
            run();
          }
        });
    };

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') run();
    };
    const appSub = AppState.addEventListener('change', onChange);

    unsubNet = subscribeConnectivity((online) => {
      const kick = shouldDrainOnConnectivity(listenerOnline, online);
      listenerOnline = online;
      if (kick) run();
    });

    // Cold start: try once even if the first snapshot is slow. A not-ready
    // fetch is a skip, and the timer above keeps going until the listener
    // reports a real offline.
    run();

    return () => {
      cancelled = true;
      clearRetry();
      appSub.remove();
      unsubNet();
    };
  }, [userId, queryClient]);
}
