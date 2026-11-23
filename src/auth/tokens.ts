/**
 * Our session tokens (the API's README, "Sign-in"): a 15-minute access token, kept in memory only,
 * and a refresh token that the API rotates on every use, kept in the phone's secure storage.
 *
 * Plain TypeScript with no React Native import: `session.ts` passes in the storage and the API
 * calls, so this logic can also run against the stage API outside the app.
 *
 * - The access token is refreshed a little before it expires, and again when a request with it got
 *   a 401 (`afterUnauthorized`).
 * - **One refresh at a time:** every caller shares the refresh in flight. The API treats a refresh
 *   token shown twice as stolen and ends the session, so two parallel refreshes would sign out.
 * - **Epochs:** signing in or out starts a new one. A refresh that finishes in an older epoch
 *   belongs to a session that is over: its tokens are dropped, never stored.
 */
import type { components } from '@/api/schema'

export type TokenResponse = components['schemas']['TokenResponse']

export type RefreshTokenStore = {
  read(): Promise<string | null>
  write(refreshToken: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Where a session comes from when this phone holds no refresh token of ours (the old Microsoft
 * session, exchanged once): the tokens and what to do once they're stored, `'ended'` when that
 * session can't be used any more, or null when there's nothing at all.
 */
export type Recovered = { tokens: TokenResponse; onStored: () => Promise<void> }

export type TokenKeeperDeps = {
  store: RefreshTokenStore
  /** `POST /auth/refresh`: the new tokens, or `'ended'` for its 401 `refresh-invalid`. Throws otherwise. */
  refresh: (refreshToken: string) => Promise<TokenResponse | 'ended'>
  recover: () => Promise<Recovered | 'ended' | null>
  /** The session is over (`'expired'`), or there never was one (`'none'`): sign out. */
  onEnded: (reason: 'expired' | 'none') => Promise<void>
  now?: () => number
}

/** Refreshed this long before the access token expires (it lives 15 minutes). */
export const REFRESH_MARGIN_MS = 2 * 60_000
const MAX_LIFETIME_MS = 15 * 60_000

type Current = { accessToken: string; refreshToken: string; expiresAt: number }

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** A JWT's payload, or null when it isn't one. Only the timing claims are read, never verified. */
function jwtPayload(token: string): { iat?: unknown; exp?: unknown } | null {
  const part = token.split('.')[1]?.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  if (!part) return null
  let text = ''
  let buffer = 0
  let bits = 0
  for (const char of part) {
    const value = BASE64URL.indexOf(char)
    if (value < 0) return null
    buffer = ((buffer << 6) | value) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      text += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  try {
    const payload: unknown = JSON.parse(text)
    return typeof payload === 'object' && payload !== null ? payload : null
  } catch {
    return null
  }
}

/**
 * How long an access token is valid from when it arrived. From its own `exp - iat`, so a phone
 * clock that is off doesn't matter; from `accessTokenExpiresAt` only when the token can't be read.
 */
export function accessLifetimeMs(tokens: TokenResponse, receivedAt: number): number {
  const payload = jwtPayload(tokens.accessToken)
  const fromClaims =
    typeof payload?.exp === 'number' && typeof payload.iat === 'number'
      ? (payload.exp - payload.iat) * 1000
      : Date.parse(tokens.accessTokenExpiresAt) - receivedAt
  return Number.isFinite(fromClaims) ? Math.min(Math.max(fromClaims, 0), MAX_LIFETIME_MS) : 0
}

export function createTokenKeeper({
  store,
  refresh,
  recover,
  onEnded,
  now = Date.now,
}: TokenKeeperDeps) {
  let current: Current | null = null
  let epoch = 0
  let refreshing: Promise<string | null> | null = null

  // Storage calls run one after another, in the order they were made: a sign-out's clear always
  // lands after the write of a refresh it overtook, never before it.
  let queue: Promise<unknown> = Promise.resolve()
  function inOrder<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /**
   * Stores the refresh token first (the server has already rotated the old one), then uses the
   * tokens, unless a sign-in or sign-out happened meanwhile (then false).
   */
  async function adopt(tokens: TokenResponse, started: number): Promise<boolean> {
    const receivedAt = now()
    try {
      await inOrder(() => store.write(tokens.refreshToken))
    } catch {
      // Kept in memory for this run; the next launch may have to sign in again.
      console.warn('[auth] the refresh token could not be stored')
    }
    if (started !== epoch) return false
    current = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: receivedAt + accessLifetimeMs(tokens, receivedAt),
    }
    return true
  }

  async function renew(): Promise<string | null> {
    const started = epoch
    const stored = current?.refreshToken ?? (await inOrder(() => store.read()))
    if (started !== epoch) return null

    let tokens: TokenResponse
    let onStored: (() => Promise<void>) | null = null
    if (stored) {
      const answer = await refresh(stored)
      if (started !== epoch) return null
      if (answer === 'ended') {
        await onEnded('expired')
        return null
      }
      tokens = answer
    } else {
      const found = await recover()
      if (started !== epoch) return null
      if (found === null || found === 'ended') {
        await onEnded(found === null ? 'none' : 'expired')
        return null
      }
      tokens = found.tokens
      onStored = found.onStored
    }
    if (!(await adopt(tokens, started))) return null
    await onStored?.()
    return tokens.accessToken
  }

  /** A valid access token, refreshed first when it's missing or expires within the margin. */
  function accessToken(): Promise<string | null> {
    if (current && now() < current.expiresAt - REFRESH_MARGIN_MS) {
      return Promise.resolve(current.accessToken)
    }
    if (!refreshing) {
      const run: Promise<string | null> = renew().finally(() => {
        if (refreshing === run) refreshing = null
      })
      refreshing = run
    }
    return refreshing
  }

  return {
    accessToken,

    /**
     * After a 401 to a request sent with `sent`: the token to retry with. Another request may have
     * refreshed already; otherwise `sent` is treated as expired and one refresh runs.
     */
    afterUnauthorized(sent: string): Promise<string | null> {
      if (current && current.accessToken === sent) current = { ...current, expiresAt: 0 }
      return accessToken()
    },

    /** Whether `token` is the access token in use now (not one of an earlier session). */
    isCurrent(token: string): boolean {
      return current?.accessToken === token
    },

    /** A new session from a sign-in: what any refresh still in flight finds is dropped. */
    async begin(tokens: TokenResponse): Promise<void> {
      const started = ++epoch
      refreshing = null
      await adopt(tokens, started)
    },

    /** Ends the session on this phone. Resolves the refresh token it had, to revoke on the server. */
    async forget(): Promise<string | null> {
      epoch++
      refreshing = null
      const had = current?.refreshToken ?? null
      current = null
      const stored = had ?? (await inOrder(() => store.read()).catch(() => null))
      await inOrder(() => store.clear()).catch(() => undefined)
      return stored
    },
  }
}

export type TokenKeeper = ReturnType<typeof createTokenKeeper>
