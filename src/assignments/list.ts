import type { AssignmentRules } from '@/campusVirtual'

export type CourseGroup = { courseId: number; assignments: AssignmentRules[] }

/** When an assignment stops being "upcoming": its due date, or its cut-off when it has none. */
/** When submitting really stops: the cut-off when there is one (late submissions are open until
 * then), else the due date. A student's extension isn't known in the list. */
const endsAt = (rules: AssignmentRules) => rules.cutoffAt ?? rules.dueAt

/** Soonest due first; no due date last; same date by name. */
function bySoonest(a: AssignmentRules, b: AssignmentRules): number {
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    return a.dueAt - b.dueAt
  }
  return a.name.localeCompare(b.name)
}

/**
 * Upcoming (due later, or never closing) soonest first, and past (due date gone) latest first.
 */
export function splitByDue(
  all: AssignmentRules[],
  now: number,
): { upcoming: AssignmentRules[]; past: AssignmentRules[] } {
  const isPast = (rules: AssignmentRules) => {
    const end = endsAt(rules)
    return end !== null && end < now
  }
  return {
    upcoming: all.filter((rules) => !isPast(rules)).sort(bySoonest),
    past: all
      .filter(isPast)
      .sort((a, b) => (endsAt(b) ?? 0) - (endsAt(a) ?? 0) || a.name.localeCompare(b.name)),
  }
}

/** Grouped by course, keeping the order: a course comes where its first assignment is. */
export function groupByCourse(list: AssignmentRules[]): CourseGroup[] {
  const groups = new Map<number, CourseGroup>()
  for (const rules of list) {
    const group = groups.get(rules.courseId)
    if (group) group.assignments.push(rules)
    else groups.set(rules.courseId, { courseId: rules.courseId, assignments: [rules] })
  }
  return [...groups.values()]
}
