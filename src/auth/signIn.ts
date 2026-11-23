/**
 * The two ways to sign in (the API's README, "Sign-in"): an email and a one-time code, or UPT's
 * Microsoft account. Both end with our own tokens, handed to the session. Signing in creates the
 * account when there is none: the app never calls `POST /me`.
 */
import { plainApi, unwrap } from '@/api/http'
import { queryClient } from '@/api/queryClient'
import type { components } from '@/api/schema'
import type { Language } from '@/i18n'

import { meKey } from './account'
import { microsoftAccessToken } from './microsoft'
import { beginSession } from './session'
import type { TokenResponse } from './tokens'

export type EmailCodeSent = components['schemas']['EmailStartResponse']

/**
 * Asks the API to email a 6-digit code (`language` is the email's). The API answers the same
 * whether or not an account has that address.
 */
export async function sendEmailCode(email: string, language: Language): Promise<EmailCodeSent> {
  return unwrap(await plainApi.POST('/auth/email/start', { body: { email, language } }))
}

/** Signs in with the code from the email. */
export async function signInWithEmailCode(email: string, code: string): Promise<void> {
  await start(unwrap(await plainApi.POST('/auth/email/verify', { body: { email, code } })))
}

/**
 * "Continue with UPT": Microsoft's page, then its access token goes to the API once. Resolves
 * false when the student closed the page.
 */
export async function signInWithUpt(): Promise<boolean> {
  const accessToken = await microsoftAccessToken()
  if (!accessToken) return false
  await start(unwrap(await plainApi.POST('/auth/microsoft', { body: { accessToken } })))
  return true
}

async function start(tokens: TokenResponse) {
  await beginSession(tokens)
  // The sign-in already says who this is: Profile and the UPT banner need no request for it.
  queryClient.setQueryData(meKey, tokens.user)
}
