/**
 * The timetable's data, one TanStack Query hook per endpoint (see CONTRIBUTING.md, "Calling the
 * API"). Everything a student owns sits under the `['me', …]` keys, so invalidating `['me']`
 * after a change (or on sign-out) refreshes all of it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

type Schemas = components['schemas']
export type ActivityKind = Schemas['ActivityKind']
export type CalendarName = Schemas['CalendarNameResponse']
export type ChoiceSubject = Schemas['ChoiceSubjectResponse']
export type DayOfWeek = Schemas['DayOfWeek']
export type OfferedSlot = Schemas['OfferedSlotResponse']
export type Occurrence = Schemas['OccurrenceResponse']
export type Programme = Schemas['ProgrammeResponse']
export type Semester = Schemas['SemesterResponse']
export type StudentSettings = Schemas['StudentSettingsResponse']
export type StudyGroup = Schemas['StudyGroupResponse']

/** The student's study group (`GET /me/settings`). The root layout reads it to decide on setup. */
export function useSettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/me/settings', { signal })),
    enabled,
  })
}

/** The current semester's calendar; `null` when no semester has been imported yet (404). */
export function useSemester() {
  return useQuery({
    queryKey: ['semester', 'current'],
    queryFn: async ({ signal }) => {
      const result = await api.GET('/semesters/current', { signal })
      return result.response.status === 404 ? null : unwrap(result)
    },
    staleTime: 60 * 60_000,
  })
}

/** Programmes → years → study groups, to pick a group from. Empty when there's no semester. */
export function useProgrammes() {
  return useQuery({
    queryKey: ['timetable', 'programmes'],
    queryFn: async ({ signal }) => {
      const result = await api.GET('/timetable/programmes', { signal })
      return result.response.status === 404 ? [] : unwrap(result)
    },
    staleTime: 60 * 60_000,
  })
}

/** The subjects a group's students choose (`optional` / `pickSlot`), with their offered slots. */
export function useGroupChoices(groupId: string) {
  return useQuery({
    queryKey: ['timetable', 'groups', groupId, 'choices'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/timetable/groups/{id}/choices', {
          params: { path: { id: groupId } },
          signal,
        }),
      ),
    enabled: groupId !== '',
  })
}

/** The subjects this student has chosen, with the slot picked for each. */
export function useMySubjects() {
  return useQuery({
    queryKey: ['me', 'subjects'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/me/subjects', { signal })),
  })
}

/** The student's classes from `from` to `to` (campus dates, both included, at most 31 days). */
export function useMyTimetable(from: string, to: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['me', 'timetable', from, to],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/me/timetable', { params: { query: { from, to } }, signal })),
    enabled,
  })
}

export type SubjectPick = { subjectId: string; offeredSlotId: string | null }

/**
 * Saves the setup: the group first (subjects are checked against it), then each picked subject,
 * then drops the ones turned off. Afterwards everything under `['me']` is refetched, which is
 * what tells the root layout that setup is done.
 */
export function useSaveSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      picks,
      drops,
    }: {
      groupId: string
      picks: SubjectPick[]
      drops: string[]
    }) => {
      unwrap(await api.PUT('/me/settings', { body: { studyGroupId: groupId } }))
      for (const { subjectId, offeredSlotId } of picks) {
        unwrap(
          await api.PUT('/me/subjects/{subjectId}', {
            params: { path: { subjectId } },
            body: { offeredSlotId },
          }),
        )
      }
      for (const subjectId of drops) {
        unwrap(await api.DELETE('/me/subjects/{subjectId}', { params: { path: { subjectId } } }))
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
