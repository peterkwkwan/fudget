/**
 * Client-side rules for linking vehicles to goals in Pair mode.
 * Server RLS is the authority; this documents the product contract.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** True when the caller may attach this vehicle to a goal they own. */
export function canLinkVehicleToOwnGoal(args: {
  goalOwnerId: string;
  callerId: string;
  vehicleOwnerId: string;
  partnerId: string | null;
}): boolean {
  if (args.callerId !== args.goalOwnerId) return false;
  if (args.vehicleOwnerId === args.callerId) return true;
  return (
    args.partnerId != null && args.vehicleOwnerId === args.partnerId
  );
}

describe('pair planner link rules', () => {
  it('allows own vehicle on own goal', () => {
    assert.equal(
      canLinkVehicleToOwnGoal({
        goalOwnerId: 'a',
        callerId: 'a',
        vehicleOwnerId: 'a',
        partnerId: 'b',
      }),
      true
    );
  });

  it('allows partner vehicle on own goal when paired', () => {
    assert.equal(
      canLinkVehicleToOwnGoal({
        goalOwnerId: 'a',
        callerId: 'a',
        vehicleOwnerId: 'b',
        partnerId: 'b',
      }),
      true
    );
  });

  it('blocks partner vehicle when solo', () => {
    assert.equal(
      canLinkVehicleToOwnGoal({
        goalOwnerId: 'a',
        callerId: 'a',
        vehicleOwnerId: 'b',
        partnerId: null,
      }),
      false
    );
  });

  it('blocks linking on a goal the caller does not own', () => {
    assert.equal(
      canLinkVehicleToOwnGoal({
        goalOwnerId: 'b',
        callerId: 'a',
        vehicleOwnerId: 'a',
        partnerId: 'b',
      }),
      false
    );
  });
});
