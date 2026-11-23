/**
 * UPT's Microsoft sign-in (Entra, UPT's tenant). The app only uses it to get an Entra access token
 * for our API, which goes to the API once: `POST /auth/microsoft` to sign in, or
 * `POST /me/identities/upt-microsoft` to link UPT. Microsoft's own tokens are never kept: after that
 * call the app runs on our tokens (`session.ts`).
 */
import { AuthRequest, exchangeCodeAsync, Prompt, refreshAsync } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

import { CLIENT_ID, discovery, REDIRECT_URI, SCOPES } from './config'

WebBrowser.maybeCompleteAuthSession()

/**
 * Microsoft's page in an in-app browser tab, with an account chooser; the code exchanged with PKCE.
 * Resolves to the Entra access token, or null when the student closed the page.
 */
export async function microsoftAccessToken(): Promise<string | null> {
  const request = new AuthRequest({
    clientId: CLIENT_ID,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    usePKCE: true,
    prompt: Prompt.SelectAccount,
  })
  const result = await request.promptAsync(discovery)
  // Never the code or a token: only how the attempt ended, and Microsoft's error if any.
  console.warn(
    '[auth] Microsoft page ended:',
    result.type,
    result.type === 'error'
      ? `${result.params.error ?? ''} ${(result.params.error_description ?? '').slice(0, 160)}`
      : '',
  )
  if (result.type === 'cancel' || result.type === 'dismiss') return null
  if (result.type !== 'success') {
    throw new Error(result.type === 'error' ? (result.params.error ?? 'error') : result.type)
  }

  const tokens = await exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery,
  )
  return tokens.accessToken
}

/**
 * An Entra access token from a stored Microsoft refresh token (a phone signed in by app 0.1.3), and
 * the refresh token Microsoft rotated to (the old one when it sent none).
 */
export async function refreshMicrosoft(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const next = await refreshAsync({ clientId: CLIENT_ID, refreshToken, scopes: SCOPES }, discovery)
  return { accessToken: next.accessToken, refreshToken: next.refreshToken ?? refreshToken }
}

/** A refresh Microsoft refused (revoked, expired): that session can't be used any more. */
export function isRefusedByMicrosoft(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'invalid_grant' || code === 'interaction_required' || code === 'invalid_client'
}
