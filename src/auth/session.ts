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

import { disconnect as disconnectCampusVirtual } from '@/campusVirtual'

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

/**
 * Each save writes the chunks under a new generation (`.g<n>.<i>`) and only then points `.current`
 * (`"<n>:<parts>"`) at it, so a crash or a failed write half-way keeps the previous token: Microsoft
 * has already rotated it, and losing both would sign the student out. Old chunks are deleted last.
 * Tokens saved before generations (`.count` + `.<i>`) are still read once, then removed.
 */
const KEY = 'auth.refreshToken'
const CHUNK = 1800

async function readPointer(): Promise<{ gen: number; parts: number } | null> {
  const [gen, parts] = ((await SecureStore.getItemAsync(`${KEY}.current`)) ?? '')
    .split(':')
    .map(Number)
  return gen > 0 && parts > 0 ? { gen, parts } : null
}

async function readChunks(prefix: string, parts: number): Promise<string | null> {
  let value = ''
  for (let i = 0; i < parts; i++) {
    const part = await SecureStore.getItemAsync(`${prefix}.${i}`)
    if (part === null) return null
    value += part
  }
  return value
}

async function deleteChunks(prefix: string, parts: number) {
  for (let i = 0; i < parts; i++) await SecureStore.deleteItemAsync(`${prefix}.${i}`)
}

async function clearLegacy() {
  const count = Number(await SecureStore.getItemAsync(`${KEY}.count`)) || 0
  await SecureStore.deleteItemAsync(`${KEY}.count`)
  await deleteChunks(KEY, Math.max(count, 8))
}

async function saveRefreshToken(value: string | undefined) {
  if (!value) return clearRefreshToken()
  const old = await readPointer()
  const gen = (old?.gen ?? 0) + 1
  const parts = Math.ceil(value.length / CHUNK)
  for (let i = 0; i < parts; i++) {
    await SecureStore.setItemAsync(`${KEY}.g${gen}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
  }
  await SecureStore.setItemAsync(`${KEY}.current`, `${gen}:${parts}`)
  // The new token is safe now; leftovers of the old one only cost space.
  try {
    if (old) await deleteChunks(`${KEY}.g${old.gen}`, old.parts)
    await clearLegacy()
  } catch {
    // Removed on the next save or sign-out.
  }
}

async function readRefreshToken(): Promise<string | null> {
  const pointer = await readPointer()
  if (pointer) return readChunks(`${KEY}.g${pointer.gen}`, pointer.parts)
  const legacy = Number(await SecureStore.getItemAsync(`${KEY}.count`))
  return legacy ? readChunks(KEY, legacy) : null
}

async function clearRefreshToken() {
  const pointer = await readPointer()
  await SecureStore.deleteItemAsync(`${KEY}.current`)
  if (pointer) await deleteChunks(`${KEY}.g${pointer.gen}`, pointer.parts)
  await clearLegacy()
}

// --- refreshing ---

/** A refresh the token endpoint refused (revoked, expired): the student has to sign in again. */
function isRefused(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'invalid_grant' || code === 'interaction_required' || code === 'invalid_client'
}

let refreshing: Promise<TokenResponse | null> | null = null

/**
 * Bumped by every sign-in and sign-out. A refresh that finishes after one of them belongs to a
 * session that is over: its tokens are dropped, never saved (they'd sign the old student back in).
 */
let epoch = 0

async function refresh(refreshToken: string): Promise<TokenResponse | null> {
  const started = epoch
  try {
    const next = await refreshAsync(
      { clientId: CLIENT_ID, refreshToken, scopes: SCOPES },
      discovery,
    )
    if (started !== epoch || state.status !== 'signedIn') return null
    // Microsoft rotates refresh tokens; keep the old one only if it sent none.
    if (!next.refreshToken) next.refreshToken = refreshToken
    tokens = next
    await saveRefreshToken(next.refreshToken)
    return next
  } catch (error) {
    if (started !== epoch) return null
    if (isRefused(error)) {
      await signOut('expired')
      return null
    }
    throw error
  }
}

/** Reads the stored session once, at app start. Offline still counts as signed in. */
const LOAD_TIMEOUT_MS = 4000

export async function loadSession(): Promise<void> {
  try {
    // A Keystore read that never answers (seen on some Android devices) must not keep the splash
    // up forever: after the timeout the student signs in again.
    const refreshToken = await Promise.race([
      readRefreshToken(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS)),
    ])
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
  epoch++
  tokens = next
  await saveRefreshToken(next.refreshToken)
  setState({ status: 'signedIn', notice: null })
  return 'signedIn'
}

/**
 * Drops the tokens, and the Campus Virtual connection with them: its token is full access to the
 * student's Moodle account and must not stay for whoever signs in next. `notice` says why on the
 * sign-in screen (deleted elsewhere, expired).
 */
export async function signOut(notice: State['notice'] = null): Promise<void> {
  epoch++
  tokens = null
  try {
    await Promise.allSettled([clearRefreshToken(), disconnectCampusVirtual()])
  } finally {
    setState({ status: 'signedOut', notice })
  }
}

/** Whether a student is signed in right now (the API client's 401 handling asks). */
export function isSignedIn(): boolean {
  return state.status === 'signedIn'
}
