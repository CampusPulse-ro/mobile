/**
 * Calendar dates the way the API sends them: `YYYY-MM-DD` strings, Romanian (campus) dates, and
 * times as `HH:mm:ss` campus wall-clock times. Day arithmetic works on the strings in UTC, so the
 * phone's own time zone never moves a class to another day. To show a date, turn it into an
 * instant with `campusNoon` / `campusInstant` and format it with `useDateTimeFormat()`.
 */

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Midnight UTC of a `YYYY-MM-DD` date, in milliseconds. */
function parseDate(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function toDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

/** Midnight UTC of the last Sunday of a month (0 = January). */
function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay())
}

/**
 * Campus time's offset from UTC at an instant, in minutes: Romania is on UTC+3 from the last
 * Sunday of March to the last Sunday of October (switching at 01:00 UTC, the EU rule), UTC+2
 * otherwise. Plain arithmetic, so it doesn't depend on what the phone's Intl can parse.
 */
function campusOffsetMinutes(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear()
  const summerStarts = lastSundayUtc(year, 2) + 60 * MINUTE
  const summerEnds = lastSundayUtc(year, 9) + 60 * MINUTE
  return utcMs >= summerStarts && utcMs < summerEnds ? 180 : 120
}

/** Today's date on campus (whatever zone the phone is set to). */
export function campusToday(now: Date = new Date()): string {
  const utcMs = now.getTime()
  return toDate(utcMs + campusOffsetMinutes(utcMs) * MINUTE)
}

/** The instant a campus wall-clock time happens: `('2026-10-20', '14:00:00')`. */
export function campusInstant(date: string, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const wallClockAsUtc = parseDate(date) + (hours * 60 + minutes) * MINUTE
  // The offset is read at the guessed instant (winter time first); only the hour around a
  // switch could be off, and no class starts at 3 a.m. on a Sunday.
  const offset = campusOffsetMinutes(wallClockAsUtc - 120 * MINUTE)
  return new Date(wallClockAsUtc - offset * MINUTE)
}

/** A date-only value as an instant to format: noon on campus, safely inside that day anywhere. */
export function campusNoon(date: string): Date {
  return campusInstant(date, '12:00')
}

export function addDays(date: string, days: number): string {
  return toDate(parseDate(date) + days * DAY)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(parseDate(date)).getUTCDay()
}

export function isWeekend(date: string): boolean {
  const weekday = weekdayOf(date)
  return weekday === 0 || weekday === 6
}

/** The Monday of the week a date is in (weeks run Monday to Sunday). */
export function mondayOf(date: string): string {
  const weekday = weekdayOf(date)
  return addDays(date, weekday === 0 ? -6 : 1 - weekday)
}

/** The week the Timetable tab opens on: this one, or next week on a Saturday or Sunday. */
export function defaultWeekStart(today: string): string {
  const monday = mondayOf(today)
  return isWeekend(today) ? addDays(monday, 7) : monday
}

/** Whether a date range [from, to] (both included) contains a date. ISO strings sort as dates. */
export function isWithin(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}
