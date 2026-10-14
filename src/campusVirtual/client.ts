/**
 * The Campus Virtual (Moodle) web service, called directly from the phone with the student's own
 * token. This is UPT's Moodle, not our API (our API goes through the generated client).
 *
 * The token is full access to the student's Campus Virtual account (it could submit quizzes or
 * post in forums), so the app may call only the read-only functions listed here. Never add:
 * - `tool_mobile_call_external_functions`: it calls other functions, bypassing this list;
 * - `tool_mobile_get_autologin_key`: it turns the token into a logged-in browser session;
 * - any `*_view_*` function: they look harmless but record views and activity completion.
 */
import { SITE_URL } from './redirect'

export const READ_ONLY_FUNCTIONS = ['core_webservice_get_site_info'] as const
export type ReadOnlyFunction = (typeof READ_ONLY_FUNCTIONS)[number]

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
 * `rejected`: Moodle answered with an error code (`code`), e.g. a disabled service or account.
 * `code` never contains the token.
 */
export class CampusVirtualError extends Error {
  constructor(
    public readonly kind: 'unreachable' | 'rejected',
    public readonly code: string,
  ) {
    super(`Campus Virtual error: ${code}`)
    this.name = 'CampusVirtualError'
  }
}

const RESERVED = new Set(['wstoken', 'wsfunction', 'moodlewsrestformat'])

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export async function callReadOnly<T>(
  fn: ReadOnlyFunction,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  // Checked at runtime too: a type can be cast away, this list can't.
  if (!(READ_ONLY_FUNCTIONS as readonly string[]).includes(fn)) {
    throw new Error(`${fn} is not on the read-only allow-list`)
  }
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
  // Moodle reports errors as HTTP 200 with an `errorcode` field.
  if (body !== null && typeof body === 'object' && 'errorcode' in body) {
    const code = String((body as { errorcode: unknown }).errorcode)
    if (EXPIRED_CODES.has(code)) throw new CampusVirtualExpiredError()
    throw new CampusVirtualError('rejected', code)
  }
  return body as T
}
