/**
 * Rooms' data, one TanStack Query hook per endpoint (see CONTRIBUTING.md, "Calling the API").
 * A room's day sits under `['rooms', code, 'timetable', date]`, so the list can show the status of
 * a room whose day is already loaded without asking the server again.
 */
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

type Schemas = components['schemas']
export type Room = Schemas['RoomResponse']
export type RoomOccurrence = Schemas['RoomOccurrenceResponse']
export type RoomTimetable = Schemas['RoomTimetableResponse']

/** Every room in the timetable. Rooms change only with a new import, so an hour is fresh enough. */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/rooms', { signal })),
    staleTime: 60 * 60_000,
  })
}

/** What's on in a room on a campus date: grid classes and offered slots. */
function roomTimetableQuery(code: string, date: string) {
  return queryOptions({
    queryKey: ['rooms', code, 'timetable', date],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/rooms/{code}/timetable', {
          params: { path: { code }, query: { date } },
          signal,
        }),
      ),
    staleTime: 5 * 60_000,
  })
}

export function useRoomTimetable(code: string, date: string) {
  return useQuery({ ...roomTimetableQuery(code, date), enabled: code !== '' })
}

/**
 * Several rooms' days at once, in the order of `codes`. Only the first `fetchFirst` rooms are
 * requested (one request each); the others return only what's already cached, with no request.
 */
export function useRoomTimetables(codes: string[], date: string, fetchFirst: number) {
  return useQueries({
    queries: codes.map((code, index) => ({
      ...roomTimetableQuery(code, date),
      enabled: index < fetchFirst,
    })),
  })
}
