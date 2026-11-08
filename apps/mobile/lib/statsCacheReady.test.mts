import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPeriodStatsReady } from './statsCacheReady.ts';

test('placeholder only when nothing is cached and the fetch has not failed', () => {
  assert.equal(
    isPeriodStatsReady({
      periodCached: false,
      localListCached: false,
      failed: false,
    }),
    false
  );
});

test('phone transaction cache paints immediately (including an empty mirror)', () => {
  assert.equal(
    isPeriodStatsReady({
      periodCached: false,
      localListCached: true,
      failed: false,
    }),
    true
  );
});

test('stored period stats paint immediately', () => {
  assert.equal(
    isPeriodStatsReady({
      periodCached: true,
      localListCached: false,
      failed: false,
    }),
    true
  );
});

test('a failed fetch is ready so the error state can show', () => {
  assert.equal(
    isPeriodStatsReady({
      periodCached: false,
      localListCached: false,
      failed: true,
    }),
    true
  );
});
