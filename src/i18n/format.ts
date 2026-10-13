/**
 * Dates and times in the app's language (not the device's). The 12/24-hour choice
 * still follows the device setting, read with expo-localization.
 */
import { getCalendars } from 'expo-localization'

import { currentLanguage, type Language } from './index'

const LOCALES: Record<Language, string> = { en: 'en-GB', ro: 'ro-RO' }

function locale(): string {
  return LOCALES[currentLanguage()]
}

function hour12(): boolean | undefined {
  const uses24 = getCalendars()[0]?.uses24hourClock
  return uses24 == null ? undefined : !uses24
}

/** "Wednesday, 14 October" / "miercuri, 14 octombrie" by default. */
export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(locale(), options).format(date)
}

/** "12:30" (or "12:30 pm" on a 12-hour device). */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(),
  }).format(date)
}
