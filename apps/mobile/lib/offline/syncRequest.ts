/**
 * Single kick for outbox drain. Write/focus paths call requestOfflineSync so
 * retries stay inside useOfflineTransactionSync (trustLink + 10s timer).
 */

type Kick = () => void;

let kick: Kick | null = null;
let syncing = false;
const syncingListeners = new Set<() => void>();

export function registerOfflineSyncKick(next: Kick): () => void {
  kick = next;
  return () => {
    if (kick === next) kick = null;
  };
}

/** Ask the foreground sync hook to push/pull now (and retry if needed). */
export function requestOfflineSync(): void {
  kick?.();
}

export function getOfflineSyncing(): boolean {
  return syncing;
}

export function setOfflineSyncing(value: boolean): void {
  if (syncing === value) return;
  syncing = value;
  for (const listener of syncingListeners) listener();
}

export function subscribeOfflineSyncing(listener: () => void): () => void {
  syncingListeners.add(listener);
  return () => {
    syncingListeners.delete(listener);
  };
}
