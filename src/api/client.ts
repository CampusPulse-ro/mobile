/**
 * The CampusPulse API client. Every call to our backend goes through `api`: its paths, parameters
 * and response shapes come from `schema.d.ts`, which is generated from the API's committed OpenAPI
 * contract (`bun run api:types`). Never hand-write `fetch` to our API.
 */
import createClient from 'openapi-fetch'

import { accessTokenAfterUnauthorized, getAccessToken, sessionRefused } from '@/auth/session'
import { apiBase } from '@/config'

import { fetchWithSession } from './http'
import type { paths } from './schema'

export { ApiError, isUnreachable, problemType, TimeoutError, unwrap } from './http'

export const api = createClient<paths>({
  baseUrl: apiBase,
  // A request whose token the API refuses is retried once with a fresh one.
  fetch: fetchWithSession({
    afterUnauthorized: accessTokenAfterUnauthorized,
    refused: sessionRefused,
  }),
})

/**
 * Every request carries the signed-in student's access token (none when signed out; the public
 * endpoints don't need one).
 */
api.use({
  // Changes nothing it returns: openapi-fetch accepts a returned value only as a replacement, and
  // React Native's Request class can fail its instanceof check.
  async onRequest({ request }) {
    if (request.headers.has('Authorization')) return
    const token = await getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
  },
})
