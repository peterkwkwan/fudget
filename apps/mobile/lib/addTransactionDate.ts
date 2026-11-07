/**
 * Selected Transactions calendar day handed to Add transaction.
 * Week and month publish a civil date; list view and other tabs do not.
 */

import { zonedMidnight, zonedYmd } from '@/lib/dates';

const ADD_TRANSACTION_PATH = '/transaction/new';
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

let calendarAddDate: string | null = null;

export function setCalendarAddDate(date: string | null): void {
  if (date == null) {
    calendarAddDate = null;
    return;
  }
  calendarAddDate = YMD.test(date) ? date : null;
}

export function peekCalendarAddDate(): string | null {
  return calendarAddDate;
}

/**
 * Add-transaction route. Only the Transactions tab (`index`) forwards a
 * published calendar day; Stats, Planner, and Account stay on today.
 */
export function addTransactionHref(activeTab: string | undefined): string {
  if (activeTab !== 'index') return ADD_TRANSACTION_PATH;
  const date = peekCalendarAddDate();
  if (!date) return ADD_TRANSACTION_PATH;
  return `${ADD_TRANSACTION_PATH}?date=${date}`;
}

function isRealCivilDay(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function onCivilDay(
  date: Date,
  year: number,
  month: number,
  day: number,
  timeZone: string
): boolean {
  const got = zonedYmd(date, timeZone);
  return got.year === year && got.month === month && got.day === day;
}

/**
 * Instant whose calendar day in `timeZone` is `YYYY-MM-DD`.
 * Today keeps `now`. Any other day uses noon in that timezone so the
 * date label and day grouping match the selected cell.
 */
export function occurredAtFromDateParam(
  param: string | undefined,
  timeZone: string,
  now: Date = new Date()
): Date | null {
  if (!param) return null;
  const match = YMD.exec(param);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealCivilDay(year, month, day)) return null;

  const today = zonedYmd(now, timeZone);
  if (today.year === year && today.month === month && today.day === day) {
    return now;
  }

  const midnight = zonedMidnight(year, month, day, timeZone);
  const noon = new Date(midnight.getTime() + 12 * 60 * 60 * 1000);
  if (!onCivilDay(noon, year, month, day, timeZone)) return null;
  return noon;
}
