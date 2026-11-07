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
