/**
 * The pure part of Campus Virtual deadlines and activity completion: turning Moodle's answers into
 * the shapes the app uses. No network, no storage. Every field is read defensively: Moodle omits
 * some of them depending on the activity and the site's version.
 *
 * Shapes seen on cv.upt.ro (Moodle 5.2), October 2026:
 * - `core_calendar_get_action_events_by_timesort` → `{events: [...], firstid, lastid}`; an event has
 *   `id, name, activityname, modulename, instance, eventtype ('due' | 'close' |
 *   'expectcompletionon' …), timesort, overdue, url, course{id, shortname, fullname},
 *   action{name, url, itemcount, actionable}`. Its `instance` is the course module id (cmid), the
 *   same as the `id=` in `url` (`/mod/<module>/view.php?id=<cmid>`). Names can contain HTML
 *   entities (`&#39;`).
 * - `core_completion_get_activities_completion_status` → `{statuses: [...], warnings}`; a status
 *   has `cmid, modname, instance (the activity's own id, not the cmid), state, tracking,
 *   overrideby, valueused, hascompletion, isautomatic, istrackeduser, uservisible, timecompleted`.
 */

export type Deadline = {
  id: number
  name: string
  activityName: string
  /** Moodle's module name: `assign`, `quiz`, `forum`, `data`… */
  module: string
  /** The course module id, when the event says it; completion is looked up by it. */
  cmid: number | null
  eventType: string
  /** When it's due. */
  /** Milliseconds since the epoch: a number, not a Date, so the stored offline cache keeps it intact. */
  dueAt: number
  overdue: boolean
  url: string | null
  course: { id: number; shortName: string; fullName: string } | null
  /** What Campus Virtual asks the student to do ("Add submission"), when it says. */
  actionName: string | null
}

export type ActivityCompletion = {
  cmid: number
  module: string
  /** 0 not done, 1 done, 2 done and passed, 3 done and failed. */
  state: number
  /** 0 none, 1 the student marks it (manual), 2 Moodle marks it (automatic). */
  tracking: number
  overriddenBy: number | null
  hasCompletion: boolean
  isAutomatic: boolean
  isTrackedUser: boolean
  userVisible: boolean
}

type Raw = Record<string, unknown>

function asObject(value: unknown): Raw | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Raw)
    : null
}

function asNumber(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Moodle's formatted text as plain text: tags dropped, HTML entities decoded. */
export function plainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1))
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : entity
      }
      return ENTITIES[body.toLowerCase()] ?? entity
    })
    .trim()
}

/** The cmid in an activity link (`/mod/assign/view.php?id=123`), or null. */
function cmidFromUrl(url: string | null): number | null {
  const match = url ? /\/mod\/[a-z0-9_]+\/view\.php\?(?:[^#]*&)?id=(\d+)/.exec(url) : null
  return match ? Number(match[1]) : null
}

function parseDeadline(value: unknown): Deadline | null {
  const event = asObject(value)
  if (!event) return null
  const id = asNumber(event.id)
  const timesort = asNumber(event.timesort) ?? asNumber(event.timestart)
  if (id === null || timesort === null) return null

  const url = asString(event.url)
  const course = asObject(event.course)
  const courseId = course ? asNumber(course.id) : null
  const action = asObject(event.action)
  const name = plainText(asString(event.name) ?? '')
  return {
    id,
    name,
    activityName: plainText(asString(event.activityname) ?? '') || name,
    module: asString(event.modulename) ?? '',
    cmid: cmidFromUrl(url) ?? asNumber(event.instance),
    eventType: asString(event.eventtype) ?? '',
    dueAt: timesort * 1000,
    overdue: event.overdue === true,
    url,
    course:
      course && courseId !== null
        ? {
            id: courseId,
            shortName: plainText(asString(course.shortname) ?? ''),
            fullName: plainText(asString(course.fullname) ?? ''),
          }
        : null,
    actionName: action ? plainText(asString(action.name) ?? '') || null : null,
  }
}

/** The events of `core_calendar_get_action_events_by_timesort`, soonest first. */
export function parseDeadlines(body: unknown): Deadline[] {
  const events = asObject(body)?.events
  if (!Array.isArray(events)) return []
  return events
    .map(parseDeadline)
    .filter((deadline): deadline is Deadline => deadline !== null)
    .sort((a, b) => a.dueAt - b.dueAt)
}

/** The statuses of `core_completion_get_activities_completion_status`. */
export function parseCompletion(body: unknown): ActivityCompletion[] {
  const statuses = asObject(body)?.statuses
  if (!Array.isArray(statuses)) return []
  const result: ActivityCompletion[] = []
  for (const value of statuses) {
    const status = asObject(value)
    const cmid = status ? asNumber(status.cmid) : null
    if (!status || cmid === null) continue
    result.push({
      cmid,
      module: asString(status.modname) ?? '',
      state: asNumber(status.state) ?? 0,
      tracking: asNumber(status.tracking) ?? 0,
      overriddenBy: asNumber(status.overrideby),
      // Missing means the site doesn't send it: don't treat that as a refusal.
      hasCompletion: status.hascompletion !== false,
      isAutomatic: status.isautomatic === true,
      isTrackedUser: status.istrackeduser !== false,
      userVisible: status.uservisible !== false,
    })
  }
  return result
}

/** This deadline's activity in a course's completion statuses: same cmid, and same module. */
export function completionFor(
  deadline: Deadline,
  statuses: ActivityCompletion[],
): ActivityCompletion | null {
  if (deadline.cmid === null) return null
  return (
    statuses.find(
      (status) =>
        status.cmid === deadline.cmid && (!deadline.module || status.module === deadline.module),
    ) ?? null
  )
}

/**
 * Whether Moodle would accept the student marking this activity done or not done by hand:
 * manual tracking, not automatic, not overridden by a teacher, and the student is tracked and can
 * see it. The write's answer stays the final word.
 */
export function canMarkManually(status: ActivityCompletion | null): status is ActivityCompletion {
  return (
    status !== null &&
    status.tracking === 1 &&
    status.hasCompletion &&
    !status.isAutomatic &&
    status.overriddenBy === null &&
    status.isTrackedUser &&
    status.userVisible
  )
}

export function isDone(status: ActivityCompletion): boolean {
  // 3 = done but failed: still "done" for the student's own tick.
  return status.state >= 1
}
