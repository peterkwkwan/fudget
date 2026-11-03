import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyBalanceDelta,
  balanceDeltasForTxnChange,
  linkedTxnSignedDelta,
  snapshotsAfterDeltas,
} from './vehicleBalance.ts';

describe('vehicleBalance', () => {
  it('income adds and expense subtracts', () => {
    assert.equal(
      linkedTxnSignedDelta({
        vehicle_id: 'a',
        type: 'income',
        amount: 25,
      }),
      25
    );
    assert.equal(
      linkedTxnSignedDelta({
        vehicle_id: 'a',
        type: 'expense',
        amount: 12.5,
      }),
      -12.5
    );
  });

  it('null account yields zero delta', () => {
    assert.equal(
      linkedTxnSignedDelta({
        vehicle_id: null,
        type: 'expense',
        amount: 10,
      }),
      0
    );
  });

  it('clamps balance at zero', () => {
    assert.equal(applyBalanceDelta(5, -10), 0);
    assert.equal(applyBalanceDelta(100, 12.345), 112.35);
  });

  it('edit reverses prior and applies next on the same account', () => {
    const deltas = balanceDeltasForTxnChange(
      { vehicle_id: 'a', type: 'expense', amount: 10 },
      { vehicle_id: 'a', type: 'expense', amount: 30 }
    );
    assert.deepEqual(deltas, [{ vehicle_id: 'a', delta: -20 }]);
  });

  it('moving link between accounts reverses old and applies new', () => {
    const deltas = balanceDeltasForTxnChange(
      { vehicle_id: 'a', type: 'income', amount: 40 },
      { vehicle_id: 'b', type: 'income', amount: 40 }
    );
    assert.deepEqual(
      new Map(deltas.map((d) => [d.vehicle_id, d.delta])),
      new Map([
        ['a', -40],
        ['b', 40],
      ])
    );
  });

  it('delete reverses the linked effect', () => {
    const deltas = balanceDeltasForTxnChange(
      { vehicle_id: 'a', type: 'expense', amount: 15 },
      null
    );
    assert.deepEqual(deltas, [{ vehicle_id: 'a', delta: 15 }]);
  });

  it('unlinked create/update produces no deltas', () => {
    assert.deepEqual(
      balanceDeltasForTxnChange(null, {
        vehicle_id: null,
        type: 'expense',
        amount: 9,
      }),
      []
    );
  });

  it('snapshotsAfterDeltas folds onto a balance map', () => {
    const snaps = snapshotsAfterDeltas(
      new Map([
        ['a', 100],
        ['b', 50],
      ]),
      [
        { vehicle_id: 'a', delta: -20 },
        { vehicle_id: 'b', delta: 10 },
      ]
    );
    assert.deepEqual(snaps, [
      { vehicle_id: 'a', balance: 80 },
      { vehicle_id: 'b', balance: 60 },
    ]);
  });
});
