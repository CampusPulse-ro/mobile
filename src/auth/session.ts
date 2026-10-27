/**
 * The signed-in student: Microsoft tokens for our API and the session state screens read.
 *
 * - The refresh token is kept in SecureStore (the Keychain / Android Keystore), split into chunks
 *   because SecureStore values over 2 KB may be refused. The access token lives in memory only.
 * - `signIn()` is the interactive sign-in. Only it calls `POST /me` (the API's rule: never on app
 *   start or after a silent refresh, so a phone that still holds tokens can't re-create an account
 *   the student deleted elsewhere).
 * - `getAccessToken()` refreshes silently when the token is about to expire; a refresh Microsoft
 *   refuses signs the student out.
 */
import {
  AuthRequest,
  exchangeCodeAsync,
  Prompt,
  refreshAsync,
  type TokenResponse,
} from 'expo-auth-session'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { useSyncExternalStore } from 'react'

import { CLIENT_ID, discovery, REDIRECT_URI, SCOPES } from './config'

WebBrowser.maybeCompleteAuthSession()

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'

type State = { status: SessionStatus; notice: 'accountGone' | 'expired' | null }

let state: State = { status: 'loading', notice: null }
let tokens: TokenResponse | null = null
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  listeners.forEach((listener) => listener())
}

/** The session state for screens: re-renders when it changes. */
export function useSession(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

// --- the refresh token in SecureStore, in chunks ---

const KEY = 'auth.refreshToken'
const CHUNK = 1800

async function saveRefreshToken(value: string | undefined) {
  await clearRefreshToken()
  if (!value) return
  const parts = Math.ceil(value.length / CHUNK)
  for (let i = 0; i < parts; i++) {
    await SecureStore.setItemAsync(`${KEY}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
  }
  await SecureStore.setItemAsync(`${KEY}.count`, String(parts))
}

async function readRefreshToken(): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(`${KEY}.count`))
  if (!count) return null
  let value = ''
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${KEY}.${i}`)
    if (part === null) return null
    value += part
  }
  return value
}

async function clearRefreshToken() {
  const count = Number(await SecureStore.getItemAsync(`${KEY}.count`)) || 0
  await SecureStore.deleteItemAsync(`${KEY}.count`)
  for (let i = 0; i < Math.max(count, 8); i++) await SecureStore.deleteItemAsync(`${KEY}.${i}`)
}

// --- refreshing ---

/** A refresh the token endpoint refused (revoked, expired): the student has to sign in again. */
function isRefused(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'invalid_grant' || code === 'interaction_required' || code === 'invalid_client'
}

let refreshing: Promise<TokenResponse | null> | null = null

async function refresh(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const next = await refreshAsync(
      { clientId: CLIENT_ID, refreshToken, scopes: SCOPES },
      discovery,
    )
    // Microsoft rotates refresh tokens; keep the old one only if it sent none.
    if (!next.refreshToken) next.refreshToken = refreshToken
    tokens = next
    await saveRefreshToken(next.refreshToken)
    return next
  } catch (error) {
    if (isRefused(error)) {
      await signOut('expired')
      return null
    }
    throw error
  }
}

/** Reads the stored session once, at app start. Offline still counts as signed in. */
export async function loadSession(): Promise<void> {
  try {
    const refreshToken = await readRefreshToken()
    if (!refreshToken) return setState({ status: 'signedOut', notice: null })
    setState({ status: 'signedIn', notice: null })
    // Get an access token now, so the first screen's requests don't each wait for one.
    void getAccessToken().catch(() => undefined)
  } catch {
    setState({ status: 'signedOut', notice: null })
  }
}

/** A valid access token for our API, refreshed when it expires within 5 minutes; null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (state.status !== 'signedIn') return null
  // shouldRefresh(): expired, or expiring within 10 minutes.
  if (tokens && !tokens.shouldRefresh()) return tokens.accessToken
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = tokens?.refreshToken ?? (await readRefreshToken())
      if (!refreshToken) {
        await signOut(null)
        return null
      }
      return refresh(refreshToken)
    })().finally(() => {
      refreshing = null
    })
  }
  return (await refreshing)?.accessToken ?? null
}

// --- signing in and out ---

export type SignInResult = 'signedIn' | 'cancelled'

/**
 * The interactive sign-in: Microsoft's page in an in-app browser tab, the code exchanged with PKCE,
 * then `POST /me` (passed in, so this module doesn't import the API client that imports it).
 */
export async function signIn(
  createAccount: (accessToken: string) => Promise<void>,
): Promise<SignInResult> {
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
    '[auth] sign-in page ended:',
    result.type,
    result.type === 'error'
      ? `${result.params.error ?? ''} ${(result.params.error_description ?? '').slice(0, 160)}`
      : '',
  )
  if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled'
  if (result.type !== 'success') {
    throw new Error(result.type === 'error' ? (result.params.error ?? 'error') : result.type)
  }

  const next = await exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery,
  )
  await createAccount(next.accessToken)
  tokens = next
  await saveRefreshToken(next.refreshToken)
  setState({ status: 'signedIn', notice: null })
  return 'signedIn'
}

/** Drops the tokens. `notice` says why on the sign-in screen (deleted elsewhere, expired). */
export async function signOut(notice: State['notice'] = null): Promise<void> {
  tokens = null
  try {
    await clearRefreshToken()
  } finally {
    setState({ status: 'signedOut', notice })
  }
}
