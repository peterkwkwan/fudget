import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDisplayDate } from './dates.ts';

describe('formatDisplayDate', () => {
  it('uses the full weekday (Thursday, not Thu)', () => {
    // 2026-10-29 is Thursday. Noon UTC stays that civil day in UTC.
    const label = formatDisplayDate('2026-10-29T12:00:00.000Z', 'UTC');
    const expected = new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date('2026-10-29T12:00:00.000Z'));
    assert.equal(label, expected);
    assert.match(label, /Thursday/);
  });

  it('reuses the cached formatter for the same timezone', () => {
    const a = formatDisplayDate('2026-10-29T12:00:00.000Z', 'UTC');
    const b = formatDisplayDate('2026-10-30T12:00:00.000Z', 'UTC');
    assert.match(a, /Thursday/);
    assert.match(b, /Friday/);
  });
});
