/**
 * Connectivity gate for banners + sync. Pure state mapping — no NetInfo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isStateOnline,
  shouldDrainOnConnectivity,
  shouldRetrySync,
} from './netState.ts';

describe('isStateOnline', () => {
  it('is online when the link is up, even if reachability is false', () => {
    assert.equal(
      isStateOnline({
        isConnected: true,
        isInternetReachable: false,
      }),
      true
    );
  });

  it('is online when reachability is still unknown', () => {
    assert.equal(
      isStateOnline({
        isConnected: true,
        isInternetReachable: null,
      }),
      true
    );
  });

  it('is offline when the link is down', () => {
    assert.equal(
      isStateOnline({
        isConnected: false,
        isInternetReachable: false,
      }),
      false
    );
  });

  it('is offline when connected is null', () => {
    assert.equal(
      isStateOnline({
        isConnected: null,
        isInternetReachable: true,
      }),
      false
    );
  });
});

describe('sync drain while the radio is up', () => {
  it('drains on the first online snapshot, not only after an offline gap', () => {
    assert.equal(shouldDrainOnConnectivity(null, true), true);
    assert.equal(shouldDrainOnConnectivity(false, true), true);
    assert.equal(shouldDrainOnConnectivity(true, true), false);
    assert.equal(shouldDrainOnConnectivity(null, false), false);
    assert.equal(shouldDrainOnConnectivity(true, false), false);
  });

  it('retries a skipped fetch unless the listener knows the radio is down', () => {
    assert.equal(
      shouldRetrySync({ skipped: true, failed: 0, listenerOnline: null }),
      true
    );
    assert.equal(
      shouldRetrySync({ skipped: true, failed: 0, listenerOnline: true }),
      true
    );
    assert.equal(
      shouldRetrySync({ skipped: true, failed: 0, listenerOnline: false }),
      false
    );
    assert.equal(
      shouldRetrySync({ skipped: false, failed: 1, listenerOnline: true }),
      true
    );
    assert.equal(
      shouldRetrySync({ skipped: false, failed: 1, listenerOnline: null }),
      true
    );
    assert.equal(
      shouldRetrySync({ skipped: false, failed: 1, listenerOnline: false }),
      false
    );
    assert.equal(
      shouldRetrySync({ skipped: false, failed: 0, listenerOnline: true }),
      false
    );
  });
});
