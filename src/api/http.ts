/**
 * What every call to our API shares: the timeout, the retry after a refused token, `unwrap` and
 * `ApiError`. Separate from `client.ts` because the session (src/auth) calls the API too, for
 * `/auth/*`, and `client.ts` imports the session for its tokens. No React Native import, so the
 * token handling can also be run against the stage API outside the app.
 */
import createClient from 'openapi-fetch'

import { apiBase } from '@/config'

import type { paths } from './schema'

/** How long a request may take. React Native sets no timeout on Android (iOS: 60 s). */
const TIMEOUT_MS = 15_000

/** A request that took longer than `TIMEOUT_MS`; shown like any other "can't reach" failure. */
export class TimeoutError extends Error {
  constructor() {
    super(`API request timed out after ${TIMEOUT_MS / 1000} s`)
    this.name = 'TimeoutError'
  }
}

/**
 * `fetch` with a timeout that also follows the caller's signal (TanStack Query cancels requests
 * it no longer needs). A plain AbortController + setTimeout, because React Native's AbortSignal
 * has no `timeout()` or `any()`.
 */
export function fetchWithTimeout(request: Request): Promise<Response> {
  const controller = new AbortController()
  const outer = request.signal
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const followOuter = () => controller.abort()
  if (outer?.aborted) controller.abort()
  else outer?.addEventListener('abort', followOuter)

  return fetch(request, { signal: controller.signal })
    .catch((error: unknown) => {
      throw timedOut ? new TimeoutError() : error
    })
    .finally(() => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', followOuter)
    })
}

const BEARER = /^Bearer (.+)$/

/**
 * A 401 about the token the request carried: the API's bare challenge. A 401 with a problem body is
 * the endpoint's own answer about something else (a Microsoft token refused while linking UPT).
 */
function tokenRefused(response: Response): boolean {
  return (
    response.status === 401 &&
    !(response.headers.get('Content-Type') ?? '').includes('application/problem+json')
  )
}

/**
 * `fetchWithTimeout` for requests that carry the session's access token: when the API refuses the
 * token, it asks the session for a fresh one (one refresh) and retries the request once. The token
 * may have expired on the way, or the phone's clock is off. Refused again with a fresh token, the
 * session doesn't work: `refused` signs out.
 */
export function fetchWithSession(session: {
  afterUnauthorized: (sent: string) => Promise<string | null>
  refused: (token: string) => Promise<void>
}) {
  return async (request: Request): Promise<Response> => {
    const sent = BEARER.exec(request.headers.get('Authorization') ?? '')?.[1]
    if (!sent) return fetchWithTimeout(request)
    // A request's body can be sent only once: keep a copy for the retry.
    const retry = request.clone()
    const response = await fetchWithTimeout(request)
    if (!tokenRefused(response)) return response

    const fresh = await session.afterUnauthorized(sent)
    if (!fresh) return response
    retry.headers.set('Authorization', `Bearer ${fresh}`)
    const retried = await fetchWithTimeout(retry)
    if (tokenRefused(retried)) await session.refused(fresh)
    return retried
  }
}

/**
 * The API without the signed-in student's token: for `/auth/*` (signing in, refreshing, signing
 * out), which the session itself calls. Everything else goes through `api` in `client.ts`.
 */
export const plainApi = createClient<paths>({ baseUrl: apiBase, fetch: fetchWithTimeout })

/**
 * A response from our API that wasn't a success (the server answered, with an error status).
 * `type` is the ProblemDetails `type` the API documents per endpoint (`invalid-code`,
 * `identity-in-use`…): branch on it, never on the title or detail. `retryAfter` is the 429's
 * `Retry-After`, in seconds.
 */
export class ApiError extends Error {
  readonly type: string | null
  readonly retryAfter: number | null

  constructor(
    readonly status: number,
    readonly body: unknown,
    retryAfter: string | null = null,
  ) {
    super(`API responded ${status}`)
    this.name = 'ApiError'
    const type = (body as { type?: unknown } | null)?.type
    this.type = typeof type === 'string' ? type : null
    const seconds = Number(retryAfter)
    this.retryAfter =
      retryAfter !== null && Number.isFinite(seconds) && seconds > 0 ? seconds : null
  }
}

/**
 * Unwraps an openapi-fetch result for TanStack Query: the data for any 2xx response (a 204 or an
 * empty 200 is a success with no data), otherwise an `ApiError` with the status. A network
 * failure or a timeout already throws on its own, so `useQuery` gets its error state either way.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) {
    throw new ApiError(
      result.response.status,
      result.error,
      result.response.headers.get('Retry-After'),
    )
  }
  return result.data as T
}

/**
 * A request that never got an answer: no connection, or the timeout. React Native's fetch rejects
 * with a `TypeError` ("Network request failed") when it can't connect.
 */
export function isUnreachable(error: unknown): boolean {
  return error instanceof TimeoutError || error instanceof TypeError
}

/** The ProblemDetails `type` of an error, when the API answered with one. */
export function problemType(error: unknown): string | null {
  return error instanceof ApiError ? error.type : null
}
