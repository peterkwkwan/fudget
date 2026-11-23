import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { catchUpRecurring, recurringKeys } from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';

/** Let Transactions finish first paint before the edge invoke. */
const COLD_START_DEFER_MS = 1_500;

/**
 * On sign-in and each return to foreground, ask the server to fill missing
 * recurring instances for this user (covers missed cron).
 *
 * Cold start waits a short delay so the catch-up does not race the first
 * local list / sync. Foreground returns still run promptly.
 */
export function useCatchUpRecurring() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let coldTimer: ReturnType<typeof setTimeout> | null = null;

    async function run() {
      if (cancelled || inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await catchUpRecurring();
        if (result.ok && (result.inserted ?? 0) > 0) {
          void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          void queryClient.invalidateQueries({ queryKey: statsKeys.all });
          void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
        }
      } catch (err) {
        console.warn('[recurring] catch-up failed', err);
      } finally {
        inFlight.current = false;
      }
    }

    // Defer off the cold-start critical path (list + sync).
    // RN 0.88 removed InteractionManager; a short timeout is enough here.
    coldTimer = setTimeout(() => {
      coldTimer = null;
      if (!cancelled) void run();
    }, COLD_START_DEFER_MS);

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void run();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      cancelled = true;
      if (coldTimer != null) clearTimeout(coldTimer);
      sub.remove();
    };
  }, [session, queryClient]);
}
