import { campusInstant } from '@/timetable'

import type { RoomOccurrence } from './api'

/**
 * Whether a room is taken right now, from its day's occurrences. Offered slots count as taken:
 * the subject is held there at that time for the students who picked it.
 *
 * - `inUse`: something is on; `until` is when the room frees up, with back-to-back classes joined.
 * - `free`: nothing on; `next` is the next thing that day, or null when the day is done.
 */
export type RoomStatus =
  | { kind: 'inUse'; current: RoomOccurrence; until: Date }
  | { kind: 'free'; next: { occurrence: RoomOccurrence; at: Date } | null }

/** Occurrences in time order. `HH:mm:ss` strings sort as they read. */
export function sortOccurrences(occurrences: RoomOccurrence[]): RoomOccurrence[] {
  return [...occurrences].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt),
  )
}

/** A stable list key for an occurrence (two offers of one subject can share a time). */
export function occurrenceKey(occurrence: RoomOccurrence, index: number): string {
  return `${occurrence.startsAt}/${occurrence.subject}/${index}`
}

/** Whether an occurrence on `date` is going on at `now`. */
export function isOn(occurrence: RoomOccurrence, date: string, now: Date): boolean {
  const time = now.getTime()
  return (
    time >= campusInstant(date, occurrence.startsAt).getTime() &&
    time < campusInstant(date, occurrence.endsAt).getTime()
  )
}

/** Where an occurrence on `date` is relative to `now`: finished, going on, or still ahead. */
export function occurrenceTiming(
  occurrence: RoomOccurrence,
  date: string,
  now: Date,
): 'past' | 'now' | 'later' {
  const time = now.getTime()
  if (time >= campusInstant(date, occurrence.endsAt).getTime()) return 'past'
  return isOn(occurrence, date, now) ? 'now' : 'later'
}

/** The room's status at `now`, for the occurrences of `date` (meant for today's date). */
export function roomStatus(occurrences: RoomOccurrence[], date: string, now: Date): RoomStatus {
  const sorted = sortOccurrences(occurrences)
  const time = now.getTime()
  const current = sorted.find((occurrence) => isOn(occurrence, date, now))
  if (current) {
    // Follow on through anything that starts before the room frees up.
    let until = campusInstant(date, current.endsAt).getTime()
    for (const occurrence of sorted) {
      const startsAt = campusInstant(date, occurrence.startsAt).getTime()
      const endsAt = campusInstant(date, occurrence.endsAt).getTime()
      if (startsAt <= until && endsAt > until) until = endsAt
    }
    return { kind: 'inUse', current, until: new Date(until) }
  }
  const next = sorted.find(
    (occurrence) => campusInstant(date, occurrence.startsAt).getTime() > time,
  )
  return {
    kind: 'free',
    next: next ? { occurrence: next, at: campusInstant(date, next.startsAt) } : null,
  }
}

/**
 * Text to search rooms by: lower case, without diacritics (ș, ț, ă, î, â, cedilla forms too),
 * so "sala a" finds "Sala Ă".
 */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Whether every word of a search matches the room's code or building. */
export function matchesSearch(
  room: { code: string; building: string | null },
  query: string,
): boolean {
  const words = searchable(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = searchable(`${room.code} ${room.building ?? ''}`)
  return words.every((word) => haystack.includes(word))
}
