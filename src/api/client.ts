/**
 * The CampusPulse API client. Every call to our backend goes through `api`: its paths, parameters
 * and response shapes come from `schema.d.ts`, which is generated from the API's committed OpenAPI
 * contract (`bun run api:types`). Never hand-write `fetch` to our API.
 */
import createClient from 'openapi-fetch'

import { getAccessToken, signOut } from '@/auth'
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
function fetchWithTimeout(request: Request): Promise<Response> {
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

export const api = createClient<paths>({ baseUrl: apiBase, fetch: fetchWithTimeout })

/**
 * Every request carries the signed-in student's access token (none when signed out; the public
 * endpoints don't need one). A 401 on a request that had one means Microsoft's session is gone:
 * sign out, so the student sees the sign-in screen instead of errors.
 */
api.use({
  // Both hooks change nothing they return: openapi-fetch accepts a returned value only as a
  // replacement, and React Native's Request/Response classes can fail its instanceof check.
  async onRequest({ request }) {
    if (request.headers.has('Authorization')) return
    const token = await getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
  },
  async onResponse({ request, response }) {
    if (response.status === 401 && request.headers.has('Authorization')) await signOut('expired')
  },
})

/** `POST /me` with the token from an interactive sign-in, before the session holds it. */
export async function createAccount(accessToken: string): Promise<void> {
  const result = await api.POST('/me', { headers: { Authorization: `Bearer ${accessToken}` } })
  unwrap(result)
}

/** A response from our API that wasn't a success (the server answered, with an error status). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API responded ${status}`)
    this.name = 'ApiError'
  }
}

/**
 * Unwraps an openapi-fetch result for TanStack Query: the data for any 2xx response (a 204 or an
 * empty 200 is a success with no data), otherwise an `ApiError` with the status. A network
 * failure or a timeout already throws on its own, so `useQuery` gets its error state either way.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) throw new ApiError(result.response.status, result.error)
  return result.data as T
}
