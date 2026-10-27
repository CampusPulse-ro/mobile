/**
 * Campus Virtual deadlines and activity completion as TanStack Query hooks. The calls go straight
 * to Moodle with the student's token (src/campusVirtual), never through our API.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  CampusVirtualExpiredError,
  getCourseCompletion,
  getDeadlines,
  setManualCompletion,
  type ActivityCompletion,
  type Deadline,
} from '@/campusVirtual'
import { campusInstant, campusToday } from '@/timetable/dates'

export const deadlinesKey = ['campusVirtual', 'deadlines'] as const

export function completionKey(courseId: number) {
  return ['campusVirtual', 'completion', courseId] as const
}

/** Expired never gets better by asking again; anything else gets one more try. */
function retryUnlessExpired(failureCount: number, error: Error) {
  return !(error instanceof CampusVirtualExpiredError) && failureCount < 1
}

/** The next 14 days of deadlines from the start of today (campus time); null when not connected. */
export function useDeadlines() {
  return useQuery({
    queryKey: deadlinesKey,
    queryFn: () => getDeadlines(campusInstant(campusToday(), '00:00')),
    staleTime: 5 * 60_000,
    retry: retryUnlessExpired,
  })
}

/** Completion statuses of a course's activities; null when not connected. */
export function useCourseCompletion(courseId: number | null) {
  return useQuery({
    queryKey: completionKey(courseId ?? 0),
    queryFn: () => (courseId === null ? null : getCourseCompletion(courseId)),
    enabled: courseId !== null,
    staleTime: 30_000,
    retry: retryUnlessExpired,
  })
}

/**
 * The course's statuses, read again when the cached ones are older than 30 seconds: what a
 * confirmation is built from.
 */
export function freshCourseCompletion(
  queryClient: QueryClient,
  courseId: number,
): Promise<ActivityCompletion[] | null> {
  return queryClient.fetchQuery({
    queryKey: completionKey(courseId),
    queryFn: () => getCourseCompletion(courseId),
    staleTime: 30_000,
  })
}

/**
 * Marks an activity done or not done on Campus Virtual (after the student confirmed). Keeps the
 * statuses read after the write and reloads the deadlines, which a completed activity can leave.
 */
export function useSetCompletion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deadline, done }: { deadline: Deadline; done: boolean }) =>
      setManualCompletion(deadline, done),
    onSuccess: async (statuses, { deadline }) => {
      if (deadline.course) queryClient.setQueryData(completionKey(deadline.course.id), statuses)
      await queryClient.invalidateQueries({ queryKey: deadlinesKey })
    },
  })
}
