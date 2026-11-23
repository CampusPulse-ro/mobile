/**
 * The signed-in student: our session tokens (`tokens.ts`) wired to the phone, and the state screens
 * read.
 *
 * - Our refresh token is in SecureStore (this device only, never in a backup); the access token in
 *   memory. `getAccessToken()` refreshes it when needed; a refresh the API refuses signs out.
 * - **Phones signed in by app 0.1.3** hold a Microsoft refresh token instead (`legacy.ts`). The
 *   first time a token is needed, it is exchanged once: Microsoft gives a fresh Entra access token,
 *   `POST /auth/microsoft` gives our tokens, and the Microsoft one is deleted. That call never
 *   brings back an account the student deleted elsewhere: when it answers `isNew`, the account it
 *   just made is deleted again and the student is signed out.
 * - Signing in happens in `signIn.ts`, which hands the tokens to `beginSession`.
 */
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

import { plainApi, unwrap } from '@/api/http'
import { disconnect as disconnectCampusVirtual } from '@/campusVirtual'

import {
  clearMicrosoftRefreshToken,
  readMicrosoftRefreshToken,
  saveMicrosoftRefreshToken,
} from './legacy'
import { isRefusedByMicrosoft, refreshMicrosoft } from './microsoft'
import { createTokenKeeper, type Recovered, type TokenResponse } from './tokens'

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'
export type SignOutNotice = 'accountGone' | 'expired' | null

type State = { status: SessionStatus; notice: SignOutNotice }

let state: State = { status: 'loading', notice: null }
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

// --- storage ---

const KEY = 'auth.session.refreshToken'
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

const store = {
  read: () => SecureStore.getItemAsync(KEY, STORE_OPTIONS),
  write: (refreshToken: string) => SecureStore.setItemAsync(KEY, refreshToken, STORE_OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, STORE_OPTIONS),
}

// --- the API calls the session makes itself ---

async function refreshSession(refreshToken: string): Promise<TokenResponse | 'ended'> {
  const result = await plainApi.POST('/auth/refresh', { body: { refreshToken } })
  return result.response.status === 401 ? 'ended' : unwrap(result)
}

/** The one-time exchange of an app 0.1.3 Microsoft session (see the top of this file). */
async function exchangeMicrosoftSession(): Promise<Recovered | 'ended' | null> {
  const stored = await readMicrosoftRefreshToken()
  if (!stored) return null
  let microsoft: Awaited<ReturnType<typeof refreshMicrosoft>>
  try {
    microsoft = await refreshMicrosoft(stored)
  } catch (error) {
    if (!isRefusedByMicrosoft(error)) throw error
    await clearMicrosoftRefreshToken().catch(() => undefined)
    return 'ended'
  }
  // Microsoft rotates its refresh tokens: keep the new one until the exchange has worked.
  if (microsoft.refreshToken !== stored) {
    await saveMicrosoftRefreshToken(microsoft.refreshToken).catch(() => undefined)
  }

  const result = await plainApi.POST('/auth/microsoft', {
    body: { accessToken: microsoft.accessToken },
  })
  if (result.response.status === 401) {
    await clearMicrosoftRefreshToken().catch(() => undefined)
    return 'ended'
  }
  const tokens = unwrap(result)
  if (tokens.isNew) {
    // There was no account any more: the student deleted it (maybe on another device). Undo the
    // one this call just made, so a phone that still held tokens can't bring it back.
    await plainApi
      .DELETE('/me', { headers: { Authorization: `Bearer ${tokens.accessToken}` } })
      .catch(() => undefined)
    await signOut('accountGone')
    return null
  }
  console.warn('[auth] the Microsoft session was exchanged for a CampusPulse one')
  return { tokens, onStored: () => clearMicrosoftRefreshToken().catch(() => undefined) }
}

const keeper = createTokenKeeper({
  store,
  refresh: refreshSession,
  recover: exchangeMicrosoftSession,
  onEnded: (reason) => signOut(reason === 'expired' ? 'expired' : null),
})

// --- what the rest of the app uses ---

/** Reads the stored session once, at app start. Offline still counts as signed in. */
const LOAD_TIMEOUT_MS = 4000

export async function loadSession(): Promise<void> {
  try {
    // A Keystore read that never answers (seen on some Android devices) must not keep the splash
    // up forever: after the timeout the student signs in again.
    const found = await Promise.race([
      (async () => (await store.read()) ?? (await readMicrosoftRefreshToken()))(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS)),
    ])
    if (!found) return setState({ status: 'signedOut', notice: null })
    setState({ status: 'signedIn', notice: null })
    // Get an access token now, so the first screen's requests don't each wait for one.
    void getAccessToken().catch(() => undefined)
  } catch {
    setState({ status: 'signedOut', notice: null })
  }
}

/** A valid access token for our API (refreshed when needed), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  return state.status === 'signedIn' ? keeper.accessToken() : null
}

/** After our API answered 401 to a request sent with `sent`: the token to retry it with, once. */
export async function accessTokenAfterUnauthorized(sent: string): Promise<string | null> {
  return state.status === 'signedIn' ? keeper.afterUnauthorized(sent) : null
}

/** The API refused a token it was just given: this session doesn't work, sign out. */
export async function sessionRefused(token: string): Promise<void> {
  if (state.status === 'signedIn' && keeper.isCurrent(token)) await signOut('expired')
}

/** Starts the session a sign-in returned (`signIn.ts`). */
export async function beginSession(tokens: TokenResponse): Promise<void> {
  await keeper.begin(tokens)
  // A phone that signs in fresh has no use for an old Microsoft session any more.
  await clearMicrosoftRefreshToken().catch(() => undefined)
  setState({ status: 'signedIn', notice: null })
}

/**
 * Drops the tokens, and the Campus Virtual connection with them: its token is full access to the
 * student's Moodle account and must not stay for whoever signs in next. `notice` says why on the
 * sign-in screen (deleted elsewhere, expired); without one it's the student's own sign-out, and the
 * session is also ended on the server (without waiting: offline, it ends on this phone anyway).
 */
export async function signOut(notice: SignOutNotice = null): Promise<void> {
  try {
    const refreshToken = await keeper.forget()
    if (refreshToken && notice === null) {
      void plainApi.POST('/auth/sign-out', { body: { refreshToken } }).catch(() => undefined)
    }
    await Promise.allSettled([clearMicrosoftRefreshToken(), disconnectCampusVirtual()])
  } finally {
    setState({ status: 'signedOut', notice })
  }
}
