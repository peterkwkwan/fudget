/**
 * Pure connectivity mapping for banners + sync gates.
 * Kept free of NetInfo so Node unit tests can import it.
 */

export type ConnectivitySnapshot = {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
};

/**
 * Link is up. We intentionally ignore `isInternetReachable === false`.
 * On Android that flag false-negatives often (captive-portal probes, DNS,
 * brief flaps) while Supabase still works — which stuck the offline /
 * “Saved on phone” banner and skipped outbox drain.
 * Real transport failures still surface via sync errors + retry copy.
 */
export function isStateOnline(state: ConnectivitySnapshot): boolean {
  return state.isConnected === true;
}

/**
 * Kick a drain when the link becomes up, including the first snapshot.
 * A repeat "still online" event does not need another kick; a failed drain
 * has its own retry timer.
 */
export function shouldDrainOnConnectivity(
  previousOnline: boolean | null,
  online: boolean
): boolean {
  return online && previousOnline !== true;
}

/**
 * Keep the foreground retry timer alive.
 * `NetInfo.fetch()` often reports offline for a moment while the listener
 * (and the status bar) already show a live radio. Treating that skip as
 * "stop" left "Saved on phone — sync will retry" on screen with 4G up.
 * A listener that knows we are offline waits for the next online edge.
 */
export function shouldRetrySync(input: {
  skipped: boolean;
  failed: number;
  listenerOnline: boolean | null;
}): boolean {
  if (input.listenerOnline === false) return false;
  return input.failed > 0 || input.skipped;
}
