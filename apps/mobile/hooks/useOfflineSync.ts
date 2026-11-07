import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { logOffline } from '@/lib/offline/log';
import { subscribeOnline } from '@/lib/offline/net';
import { syncNow } from '@/lib/offline/syncEngine';
import { offlineUxKeys } from '@/lib/offline/ux';
import { transactionKeys } from '@/lib/transactions';

/** Retry a failed flush while the app stays foreground (plan: drain when online). */
const RETRY_MS = 10_000;

/**
 * Foreground and reconnect sync. No-op while OFFLINE_TXNS_ENABLED is false,
 * so NetInfo is not subscribed and the device DB is not opened.
 *
 * Also retries on a timer after a failed push so “Saved on phone — sync will
 * retry” does not stick forever while the user stays in the app online.
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
      inFlight = true;
      void syncNow(userId)
        .then((result) => {
          if (cancelled) return;
          void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
          if (result.skipped) return;
          if (
            result.pushed > 0 ||
            result.pulled > 0 ||
            result.dropped > 0 ||
            result.failed > 0
          ) {
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          }
          if (result.failed > 0) {
            logOffline('sync push failed', { op: 'push' });
            scheduleRetry();
          }
        })
        .catch(() => {
          logOffline('sync failed', { op: 'sync' });
          if (!cancelled) {
            void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
            scheduleRetry();
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

    run();

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        clearRetry();
        run();
      }
    };
    const appSub = AppState.addEventListener('change', onChange);

    unsubNet = subscribeOnline(() => {
      clearRetry();
      run();
    });

    return () => {
      cancelled = true;
      clearRetry();
      appSub.remove();
      unsubNet();
    };
  }, [userId, queryClient]);
}
