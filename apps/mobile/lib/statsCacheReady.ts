/**
 * Whether Stats can paint this period without a loading placeholder.
 * A mirror that loaded and has zero transactions is ready (Quiet month).
 * Placeholder is only for "nothing cached yet".
 */
export function isPeriodStatsReady(input: {
  /** Totals and categories already stored for this period (local or remote). */
  periodCached: boolean;
  /** SQLite transaction list is in memory, so this period can be aggregated now. */
  localListCached: boolean;
  /** Active fetch failed — show the error, not an endless placeholder. */
  failed: boolean;
}): boolean {
  return input.periodCached || input.localListCached || input.failed;
}
