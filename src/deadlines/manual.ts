/**
 * The student's own deadlines, kept by our API (`/me/deadlines`), next to the Campus Virtual ones
 * (`api.ts`, straight from Moodle). Under the `['me', …]` keys: dropped on sign-out, kept offline.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import type { Deadline } from '@/campusVirtual'

export type ManualDeadline = components['schemas']['DeadlineResponse']

export const manualDeadlinesKey = ['me', 'deadlines'] as const

/** Every deadline the student added, soonest first (the API sorts them by `dueAt`). */
export function useManualDeadlines() {
  return useQuery({
    queryKey: manualDeadlinesKey,
    queryFn: async ({ signal }) => unwrap(await api.GET('/me/deadlines', { signal })),
  })
}

/** What the form edits. `course` and `notes` are '' when empty; `dueAt` is an ISO instant. */
export type DeadlineInput = { title: string; course: string; dueAt: string; notes: string }

/** The API's limits (`400 invalid-deadline` beyond them). */
export const DEADLINE_LIMITS = { title: 200, course: 200, notes: 2000 } as const

function byDue(a: ManualDeadline, b: ManualDeadline) {
  return Date.parse(a.dueAt) - Date.parse(b.dueAt)
}

/** Puts the API's answer into the cached list, so every screen shows it without a reload. */
function keep(queryClient: QueryClient, saved: ManualDeadline) {
  queryClient.setQueryData<ManualDeadline[]>(manualDeadlinesKey, (list) =>
    [...(list ?? []).filter((deadline) => deadline.id !== saved.id), saved].sort(byDue),
  )
}

/** Adds a deadline (no `id`) or saves changes to one. */
export function useSaveDeadline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: DeadlineInput }) => {
      const title = input.title.trim()
      const course = input.course.trim()
      const notes = input.notes.trim()
      if (id === undefined) {
        return unwrap(
          await api.POST('/me/deadlines', {
            body: {
              title,
              dueAt: input.dueAt,
              course: course === '' ? null : course,
              notes: notes === '' ? null : notes,
            },
          }),
        )
      }
      // In a PATCH an empty course or notes clears it (null would leave it unchanged).
      return unwrap(
        await api.PATCH('/me/deadlines/{id}', {
          params: { path: { id } },
          body: { title, dueAt: input.dueAt, course, notes },
        }),
      )
    },
    onSuccess: (saved) => keep(queryClient, saved),
  })
}

export function useSetDeadlineDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await api.PATCH('/me/deadlines/{id}', { params: { path: { id } }, body: { done } })),
    onSuccess: (saved) => keep(queryClient, saved),
  })
}

export function useDeleteDeadline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/me/deadlines/{id}', { params: { path: { id } } })
      // Already gone (deleted on another device) is what the student wanted.
      if (result.response.status !== 404) unwrap(result)
      return id
    },
    onSuccess: (id) =>
      queryClient.setQueryData<ManualDeadline[]>(manualDeadlinesKey, (list) =>
        (list ?? []).filter((deadline) => deadline.id !== id),
      ),
  })
}

// --- both kinds in one list ---

/** A row of a deadline list: from Campus Virtual, or added by the student. */
export type DueItem =
  | { kind: 'campusVirtual'; key: string; dueAt: number; deadline: Deadline }
  | { kind: 'manual'; key: string; dueAt: number; deadline: ManualDeadline }

export function fromCampusVirtual(deadline: Deadline): DueItem {
  return { kind: 'campusVirtual', key: `cv-${deadline.id}`, dueAt: deadline.dueAt, deadline }
}

export function fromManual(deadline: ManualDeadline): DueItem {
  return { kind: 'manual', key: `own-${deadline.id}`, dueAt: Date.parse(deadline.dueAt), deadline }
}

/**
 * Campus Virtual's deadlines and the student's own ones that aren't done yet, soonest first.
 * `before` (milliseconds) leaves out own deadlines due later; overdue ones stay until marked done.
 */
export function dueList(
  campusVirtual: Deadline[] | null | undefined,
  manual: ManualDeadline[] | undefined,
  before = Number.POSITIVE_INFINITY,
): DueItem[] {
  return [
    ...(campusVirtual ?? []).map(fromCampusVirtual),
    ...(manual ?? [])
      .filter((deadline) => !deadline.done)
      .map(fromManual)
      .filter((item) => item.dueAt < before),
  ].sort((a, b) => a.dueAt - b.dueAt)
}

/** The student's done deadlines, the most recently due first. */
export function doneList(manual: ManualDeadline[] | undefined): DueItem[] {
  return (manual ?? [])
    .filter((deadline) => deadline.done)
    .map(fromManual)
    .sort((a, b) => b.dueAt - a.dueAt)
}
