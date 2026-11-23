/**
 * The student's CampusPulse account (`GET /me`): its verified email, and whether UPT is linked.
 * Linking runs UPT's Microsoft sign-in and hands its access token to the API once; Microsoft's
 * tokens aren't kept.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

import { microsoftAccessToken } from './microsoft'

export type Me = components['schemas']['MeResponse']

/**
 * Not `['me', 'account']`, the key app 0.1.3 stored `GET /me` under before it had `identities` and
 * `uptLinked`: a new key never reads that old offline copy, and the rest of the cache is kept.
 */
export const meKey = ['me', 'profile'] as const

export function useMe({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => unwrap(await api.GET('/me', { signal })),
    enabled,
  })
}

/** The linked UPT account, if any. */
export function uptIdentity(me: Me | undefined) {
  return me?.identities.find((identity) => identity.provider === 'upt-microsoft') ?? null
}

/**
 * Links a UPT account: Microsoft's page, then `POST /me/identities/upt-microsoft`. Resolves the
 * updated account, or null when the student closed the page. API errors (`identity-in-use`,
 * `already-linked`, `microsoft-token-invalid`) come back as `ApiError`s.
 */
export function useLinkUpt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<Me | null> => {
      const accessToken = await microsoftAccessToken()
      if (!accessToken) return null
      return unwrap(await api.POST('/me/identities/upt-microsoft', { body: { accessToken } }))
    },
    onSuccess: (me) => {
      if (me) queryClient.setQueryData(meKey, me)
    },
  })
}

/** Unlinks UPT; the API refuses (`last-sign-in-method`) when the account has no email. */
export function useUnlinkUpt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE('/me/identities/upt-microsoft'))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey }),
  })
}
