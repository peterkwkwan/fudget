import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { zonedYmd } from './dates.ts';
import {
  addTransactionHref,
  occurredAtFromDateParam,
  peekCalendarAddDate,
  setCalendarAddDate,
} from './addTransactionDate.ts';

afterEach(() => {
  setCalendarAddDate(null);
});

describe('calendar add date seed', () => {
  it('publishes a civil date for the Transactions tab only', () => {
    assert.equal(addTransactionHref('index'), '/transaction/new');
    assert.equal(addTransactionHref('stats'), '/transaction/new');

    setCalendarAddDate('2026-10-16');
    assert.equal(peekCalendarAddDate(), '2026-10-16');
    assert.equal(
      addTransactionHref('index'),
      '/transaction/new?date=2026-10-16'
    );
    assert.equal(addTransactionHref('stats'), '/transaction/new');
    assert.equal(addTransactionHref('planner'), '/transaction/new');
    assert.equal(addTransactionHref('account'), '/transaction/new');
    assert.equal(addTransactionHref(undefined), '/transaction/new');
  });

  it('drops a malformed seed', () => {
    setCalendarAddDate('10/16/2026');
    assert.equal(peekCalendarAddDate(), null);
    assert.equal(addTransactionHref('index'), '/transaction/new');
  });

  it('clears when the calendar selection goes away', () => {
    setCalendarAddDate('2026-10-16');
    setCalendarAddDate(null);
    assert.equal(peekCalendarAddDate(), null);
    assert.equal(addTransactionHref('index'), '/transaction/new');
  });
});

describe('occurredAtFromDateParam', () => {
  const now = new Date('2026-11-07T16:30:00.000Z');

  it('keeps the current instant when the selected day is today', () => {
    const date = occurredAtFromDateParam('2026-11-07', 'UTC', now);
    assert.equal(date?.toISOString(), now.toISOString());
  });

  it('uses noon on the selected civil day', () => {
    for (const timeZone of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
      const date = occurredAtFromDateParam('2026-10-16', timeZone, now);
      assert.ok(date);
      assert.equal(zonedYmd(date, timeZone).year, 2026);
      assert.equal(zonedYmd(date, timeZone).month, 10);
      assert.equal(zonedYmd(date, timeZone).day, 16);
    }
  });

  it('rejects missing and impossible dates', () => {
    assert.equal(occurredAtFromDateParam(undefined, 'UTC', now), null);
    assert.equal(occurredAtFromDateParam('2026-10-16T00:00:00Z', 'UTC', now), null);
    assert.equal(occurredAtFromDateParam('2026-02-31', 'UTC', now), null);
    assert.equal(occurredAtFromDateParam('2026-13-01', 'UTC', now), null);
  });
});
