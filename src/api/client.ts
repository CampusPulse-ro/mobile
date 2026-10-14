/**
 * The CampusPulse API client. Every call to our backend goes through `api`: its paths, parameters
 * and response shapes come from `schema.d.ts`, which is generated from the API's committed OpenAPI
 * contract (`bun run api:types`). Never hand-write `fetch` to our API.
 */
import createClient from 'openapi-fetch'

import { apiBase } from '@/config'

import type { paths } from './schema'

export const api = createClient<paths>({ baseUrl: apiBase })

/** A response from our API that wasn't a success (the network worked, the API said no). */
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
 * Unwraps an openapi-fetch result for TanStack Query: returns the data, or throws an `ApiError`
 * (a network failure already throws on its own), so `useQuery` gets its error state.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data
  throw new ApiError(result.response.status, result.error)
}
