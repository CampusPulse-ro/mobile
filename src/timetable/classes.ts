import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isLanguage } from '@/i18n'

import type { ActivityKind, CalendarName, Occurrence, Semester } from './api'
import { campusInstant, isWithin } from './dates'

/** Where a class is relative to now: finished, going on, or still ahead. */
export type ClassTiming = 'past' | 'now' | 'later'

export function classTiming(occurrence: Occurrence, now: Date): ClassTiming {
  const startsAt = campusInstant(occurrence.date, occurrence.startsAt).getTime()
  const endsAt = campusInstant(occurrence.date, occurrence.endsAt).getTime()
  const time = now.getTime()
  if (time >= endsAt) return 'past'
  return time >= startsAt ? 'now' : 'later'
}

/** Classes in date and time order. `HH:mm:ss` and `YYYY-MM-DD` strings sort as they read. */
export function sortClasses(occurrences: Occurrence[]): Occurrence[] {
  return [...occurrences].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt),
  )
}

/** A stable list key for a class. */
export function classKey(occurrence: Occurrence): string {
  const slot = occurrence.slotId ?? occurrence.offeredSlotId ?? occurrence.subjectId
  return `${occurrence.date}/${slot}/${occurrence.startsAt}`
}

/** Why a date has no classes, from the semester calendar: a non-teaching day or a break. */
export type DayOff =
  | { kind: 'holiday'; reason: CalendarName }
  | { kind: 'break'; name: CalendarName | null; resumesOn: string | null }

export function dayOff(semester: Semester | null | undefined, date: string): DayOff | null {
  if (!semester) return null
  const holiday = semester.nonTeachingDays.find((day) => day.date === date)
  if (holiday) return { kind: 'holiday', reason: holiday.reason }
  const pause = semester.breaks.find((b) => isWithin(date, b.from, b.to))
  if (pause) {
    const next = semester.weeks.find((week) => week.startsOn > pause.to)
    return { kind: 'break', name: pause.name, resumesOn: next?.startsOn ?? null }
  }
  return null
}

/** The current time, updated every `intervalMs`, so "now" and "finished" move on by themselves. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Text helpers that follow the UI language: calendar names (`{ ro, en }`) and class kinds. */
export function useClassText() {
  const { t, i18n } = useTranslation()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
  const kinds = (list: ActivityKind[]) => list.map((kind) => t(`classKind.${kind}`)).join(' / ')
  return {
    calendarName: (name: CalendarName) => name[language],
    /** "Lab / Project" */
    kinds,
    /** "Lab · B528B": the kinds and the room, the second line of a class row. */
    kindAndRoom: (occurrence: Pick<Occurrence, 'kinds' | 'room'>) =>
      [kinds(occurrence.kinds), occurrence.room].filter(Boolean).join(' · '),
  }
}
