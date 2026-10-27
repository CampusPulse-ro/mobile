/**
 * Campus Virtual assignments as TanStack Query hooks. The calls go straight to Moodle with the
 * student's token (src/campusVirtual), never through our API. Every key is under `campusVirtual`,
 * so the offline cache keeps the last answers (they hold no token) and a new connection drops them.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  CampusVirtualExpiredError,
  getAssignments,
  getSubmission,
  saveSubmission,
  submitForGrading,
  type AssignmentRules,
  type SubmissionFile,
  type SubmissionState,
} from '@/campusVirtual'
import { deadlinesKey } from '@/deadlines/api'

export const assignmentsKey = ['campusVirtual', 'assignments'] as const

export function submissionKey(assignmentId: number) {
  return ['campusVirtual', 'submission', assignmentId] as const
}

/** Expired never gets better by asking again; anything else gets one more try. */
function retryUnlessExpired(failureCount: number, error: Error) {
  return !(error instanceof CampusVirtualExpiredError) && failureCount < 1
}

/**
 * Every assignment in the student's courses; null when Campus Virtual isn't connected.
 * `enabled: false` only reads what's already loaded (the deadline sheet, for a non-assignment).
 */
export function useAssignments({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: assignmentsKey,
    queryFn: getAssignments,
    enabled,
    staleTime: 5 * 60_000,
    retry: retryUnlessExpired,
  })
}

/** The student's own submission for an assignment; null when not connected. */
export function useSubmission(assignmentId: number | null) {
  return useQuery({
    queryKey: submissionKey(assignmentId ?? 0),
    queryFn: () => (assignmentId === null ? null : getSubmission(assignmentId)),
    enabled: assignmentId !== null,
    staleTime: 30_000,
    retry: retryUnlessExpired,
  })
}

/**
 * The submission as last loaded, without loading it: the list shows a status only for the
 * assignments already opened, instead of asking Campus Virtual once per row.
 */
export function useKnownSubmission(assignmentId: number): SubmissionState | null {
  const query = useQuery({
    queryKey: submissionKey(assignmentId),
    queryFn: () => getSubmission(assignmentId),
    enabled: false,
  })
  return query.data ?? null
}

/**
 * The submission, read again when the cached one is older than 30 seconds: what a confirmation is
 * built from, so it describes what Campus Virtual holds now.
 */
export function freshSubmission(
  queryClient: QueryClient,
  assignmentId: number,
): Promise<SubmissionState | null> {
  return queryClient.fetchQuery({
    queryKey: submissionKey(assignmentId),
    queryFn: () => getSubmission(assignmentId),
    staleTime: 30_000,
  })
}

/** After a write: keep the submission read after it, and reload what it can change. */
function useAfterWrite() {
  const queryClient = useQueryClient()
  return {
    onSuccess: async (state: SubmissionState, { rules }: { rules: AssignmentRules }) => {
      queryClient.setQueryData(submissionKey(rules.id), state)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: deadlinesKey }),
        queryClient.invalidateQueries({ queryKey: assignmentsKey }),
      ])
    },
    // A refused or failed write may still mean the submission changed (or isn't what the cache
    // says): read it again, so the screen shows what Campus Virtual holds.
    onError: async (_error: Error, { rules }: { rules: AssignmentRules }) => {
      await queryClient.invalidateQueries({ queryKey: submissionKey(rules.id) })
    },
  }
}

/**
 * Saves the submission (a draft, or submitted when the assignment has no drafts), after the
 * student confirmed. `text` only when it changed; `files` only when new ones were picked (they
 * replace all submitted files; leaving it out keeps them).
 */
export function useSaveSubmission() {
  const after = useAfterWrite()
  return useMutation({
    mutationFn: ({
      rules,
      input,
    }: {
      rules: AssignmentRules
      input: { text?: string; files?: SubmissionFile[] }
    }) => saveSubmission(rules, input),
    ...after,
  })
}

/** Submits the saved draft for grading, after the student confirmed twice. */
export function useSubmitForGrading() {
  const after = useAfterWrite()
  return useMutation({
    mutationFn: ({
      rules,
      acceptStatement,
    }: {
      rules: AssignmentRules
      acceptStatement: boolean
    }) => submitForGrading(rules, acceptStatement),
    ...after,
  })
}
