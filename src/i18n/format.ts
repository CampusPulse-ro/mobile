/**
 * Dates and times in the app's language (not the device's), in campus time.
 *
 * Use the `useDateTimeFormat()` hook in components. It takes the language from
 * `useTranslation()`, so a language switch re-renders the component; a plain call that
 * read shared state would be cached by the React Compiler on its arguments only and keep
 * showing the old language.
 */
import { getCalendars } from 'expo-localization'
import { useTranslation } from 'react-i18next'

import { currentLanguage, isLanguage, type Language } from './index'

/** The locale each UI language formats dates and times with. */
const locales: Record<Language, string> = { en: 'en-GB', ro: 'ro-RO' }

/**
 * Campus time. Classes happen in Timișoara, so times show in its zone whatever the phone
 * is set to (a phone still on another country's time would show every class at the wrong
 * hour, and a date-only value would show as the previous day west of UTC).
 */
export const campusTimeZone = 'Europe/Bucharest'

/** What a missing or unreadable date shows instead of throwing. */
const invalidDate = '—'

/**
 * The device's 12/24-hour setting, when it's known. `hourCycle` and not `hour12`: Hermes
 * on iOS resolves `hour12: true` for en-GB/ro-RO to h11, which prints "00:30 pm".
 */
function deviceHourCycle(): Pick<Intl.DateTimeFormatOptions, 'hourCycle'> {
  const uses24 = getCalendars()[0]?.uses24hourClock
  return uses24 == null ? {} : { hourCycle: uses24 ? 'h23' : 'h12' }
}

/**
 * Formats a date and/or time for a UI language, in campus time. `options` go over the
 * defaults; pass `timeZone` only to deliberately use another zone.
 */
export function formatDateTime(
  value: Date | number,
  options: Intl.DateTimeFormatOptions,
  language: Language = currentLanguage(),
): string {
  // One bad value from the API must not throw (RangeError) and take the screen down.
  if (Number.isNaN(+value)) return invalidDate
  return new Intl.DateTimeFormat(locales[language], {
    timeZone: campusTimeZone,
    ...options,
  }).format(value)
}

const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

/** Formatters bound to the current language; components using it re-render on a switch. */
export function useDateTimeFormat() {
  const { i18n } = useTranslation()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : currentLanguage()
  const time = { ...timeOptions, ...deviceHourCycle() }
  return {
    /** "Wednesday 14 October" / "miercuri, 14 octombrie" */
    date: (value: Date | number) => formatDateTime(value, dateOptions, language),
    /** "12:30" (or "12:30 pm" on a 12-hour phone) */
    time: (value: Date | number) => formatDateTime(value, time, language),
    /** both */
    dateTime: (value: Date | number) =>
      formatDateTime(value, { ...dateOptions, ...time }, language),
  }
}
