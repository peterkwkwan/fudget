/**
 * Connectivity gate for banners + sync. Pure state mapping — no NetInfo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStateOnline } from './netState.ts';

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
