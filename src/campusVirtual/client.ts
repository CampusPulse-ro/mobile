/**
 * The Campus Virtual (Moodle) web service, called directly from the phone with the student's own
 * token. This is UPT's Moodle, not our API (our API goes through the generated client).
 *
 * The token is full access to the student's Campus Virtual account, so every call goes through one
 * of two explicit allow-lists:
 * - READ_ONLY_FUNCTIONS (`callReadOnly`): read freely; they change nothing on Campus Virtual.
 * - WRITE_FUNCTIONS (`callWrite`): each one runs only from an explicit action of the student, behind
 *   a confirmation that names exactly what changes. Moodle's answer is always checked: it reports
 *   errors as HTTP 200 with `{exception, errorcode, message}`, and many write functions answer
 *   `{status, warnings}`, where `status: false` or any warning is a failure the student is shown.
 *   The data the write affects is read again afterwards. Nothing irreversible (deleting,
 *   submitting for grading) without a second explicit confirmation.
 *
 * Never add, to either list (`NEVER` below also refuses them at runtime):
 * - `tool_mobile_call_external_functions`: it calls other functions, bypassing both lists;
 * - `tool_mobile_get_autologin_key`: it turns the token into a logged-in browser session;
 * - anything that changes the account, password, profile, preferences or privacy data;
 * - any `*_view_*` function: they look harmless but record views and activity completion.
 */
import { SITE_URL } from './redirect'

export const READ_ONLY_FUNCTIONS = [
  'core_webservice_get_site_info',
  'core_calendar_get_action_events_by_timesort',
  'core_completion_get_activities_completion_status',
] as const
export type ReadOnlyFunction = (typeof READ_ONLY_FUNCTIONS)[number]

export const WRITE_FUNCTIONS = [
  'core_completion_update_activity_completion_status_manually',
] as const
export type WriteFunction = (typeof WRITE_FUNCTIONS)[number]

/** Refused whatever list they end up on: a mistake in a list must not open these. */
const NEVER =
  /^(tool_mobile_call_external_functions|tool_mobile_get_autologin_key|core_auth_|auth_|core_user_(update|set|add|agree|remove|delete)|tool_dataprivacy_|tool_policy_)|_view_/

/**
 * The token is no longer accepted: the student must connect again. Moodle answers the first call
 * after expiry with `accessexception` (and deletes the token), later ones with `invalidtoken`.
 */
const EXPIRED_CODES = new Set(['invalidtoken', 'accessexception'])

export class CampusVirtualExpiredError extends Error {
  constructor() {
    super('Campus Virtual token is no longer valid')
    this.name = 'CampusVirtualExpiredError'
  }
}

/**
 * `unreachable`: no answer, or not a Moodle answer (network, HTTP error, not JSON).
 * `rejected`: Moodle answered with an error code (`code`), e.g. a disabled service or account;
 * `detail` is Moodle's own message for it, when it sent one. Neither contains the token.
 */
export class CampusVirtualError extends Error {
  constructor(
    public readonly kind: 'unreachable' | 'rejected',
    public readonly code: string,
    public readonly detail?: string,
  ) {
    super(`Campus Virtual error: ${code}`)
    this.name = 'CampusVirtualError'
  }
}

/** A write Moodle answered but did not carry out: `status: false`, or warnings (their messages). */
export class CampusVirtualWriteError extends Error {
  constructor(public readonly reasons: string[]) {
    super(reasons.join(' ') || 'Campus Virtual did not make the change')
    this.name = 'CampusVirtualWriteError'
  }
}

/** A fresh read says Moodle wouldn't accept the write, so it wasn't sent. */
export class CampusVirtualNotAllowedError extends Error {
  constructor() {
    super('Campus Virtual does not allow this change')
    this.name = 'CampusVirtualNotAllowedError'
  }
}

/** A value of a web service parameter; arrays are sent as `name[0]=…&name[1]=…`. */
export type MoodleParam = string | number | boolean | readonly (string | number)[]

const RESERVED = new Set(['wstoken', 'wsfunction', 'moodlewsrestformat'])

function formBody(fields: Record<string, MoodleParam>): string {
  const pairs: string[] = []
  const add = (key: string, value: string | number | boolean) =>
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item, index) => add(`${key}[${index}]`, item))
    else add(key, typeof value === 'boolean' ? (value ? 1 : 0) : (value as string | number))
  }
  return pairs.join('&')
}

function assertAllowed(fn: string, list: readonly string[], listName: string) {
  // Checked at runtime too: a type can be cast away, these checks can't.
  if (!list.includes(fn)) throw new Error(`${fn} is not on the ${listName} allow-list`)
  if (NEVER.test(fn)) throw new Error(`${fn} is never allowed`)
}

async function call(fn: string, token: string, params: Record<string, MoodleParam>) {
  for (const key of Object.keys(params)) {
    if (RESERVED.has(key)) throw new Error(`${key} can't be passed as a parameter`)
  }

  let response: Response
  try {
    response = await fetch(`${SITE_URL}/webservice/rest/server.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ ...params, wstoken: token, wsfunction: fn, moodlewsrestformat: 'json' }),
    })
  } catch {
    throw new CampusVirtualError('unreachable', 'network')
  }
  if (!response.ok) throw new CampusVirtualError('unreachable', `http_${response.status}`)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new CampusVirtualError('unreachable', 'not_json')
  }
  // Moodle reports errors as HTTP 200 with an `errorcode` field (and `exception`, `message`).
  if (body !== null && typeof body === 'object' && 'errorcode' in body) {
    const error = body as { errorcode: unknown; message?: unknown }
    const code = String(error.errorcode)
    if (EXPIRED_CODES.has(code)) throw new CampusVirtualExpiredError()
    const message = typeof error.message === 'string' ? error.message : undefined
    throw new CampusVirtualError('rejected', code, message)
  }
  return body
}

export async function callReadOnly<T>(
  fn: ReadOnlyFunction,
  token: string,
  params: Record<string, MoodleParam> = {},
): Promise<T> {
  assertAllowed(fn, READ_ONLY_FUNCTIONS, 'read-only')
  return (await call(fn, token, params)) as T
}

type WriteWarning = { message?: unknown; warningcode?: unknown }

/**
 * Changes something on Campus Virtual. Only from an explicit action of the student, after a
 * confirmation naming exactly what changes.
 *
 * Before calling: pre-validate with Moodle's own read functions and the activity's settings; only
 * offer actions Moodle says are allowed; validate user input against the activity's limits. Then
 * this checks the answer (`status: false` or any warning throws CampusVirtualWriteError, with
 * Moodle's messages), and the caller re-reads the data the write affects.
 */
export async function callWrite<T extends { status?: boolean }>(
  fn: WriteFunction,
  token: string,
  params: Record<string, MoodleParam>,
): Promise<T> {
  assertAllowed(fn, WRITE_FUNCTIONS, 'write')
  const body = await call(fn, token, params)
  if (body === null || typeof body !== 'object') throw new CampusVirtualWriteError([])
  const result = body as T & { warnings?: WriteWarning[] }
  const warnings = Array.isArray(result.warnings) ? result.warnings : []
  if (result.status === false || warnings.length > 0) {
    throw new CampusVirtualWriteError(
      warnings.map((warning) =>
        typeof warning.message === 'string' ? warning.message : String(warning.warningcode ?? ''),
      ),
    )
  }
  return result
}
