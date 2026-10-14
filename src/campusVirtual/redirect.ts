/**
 * The pure part of the Campus Virtual sign-in: building the launch URL and checking the redirect
 * Moodle sends back. No network, no storage, so it can be checked on its own.
 *
 * Moodle's mobile launch flow (the official Moodle app uses the same one): the app opens
 * `launch.php` with a random `passport`; after the student signs in with their UPT account,
 * Moodle redirects to `campuspulse://token=<base64>`, where the base64 decodes to
 * `siteid:::token[:::privatetoken]` and `siteid` = md5(site URL + passport).
 */
import { md5 } from './md5'

export const SITE_URL = 'https://cv.upt.ro'
export const REDIRECT_PREFIX = 'campuspulse://'

/**
 * A nonce that binds the redirect to this attempt: a token whose siteid wasn't made from it is
 * refused. It is not a secret, so Math.random is enough (the app has no native crypto module).
 */
export function newPassport(): string {
  let passport = Date.now().toString(16)
  while (passport.length < 32) passport += Math.floor(Math.random() * 16).toString(16)
  return passport.slice(0, 32)
}

export function launchUrl(passport: string): string {
  return (
    `${SITE_URL}/admin/tool/mobile/launch.php?service=moodle_mobile_app` +
    `&passport=${encodeURIComponent(passport)}&urlscheme=campuspulse`
  )
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Base64 (standard or URL-safe) to a one-byte-per-character string; null when invalid. */
export function decodeBase64(input: string): string | null {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (clean.length % 4 === 1) return null
  let out = ''
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    const value = BASE64.indexOf(char)
    if (value < 0) return null
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  return out
}

export type RedirectCheck =
  | { ok: true; token: string }
  | { ok: false; reason: 'not-a-token-redirect' | 'malformed' | 'site-mismatch' }

/**
 * Checks the redirect for the attempt that used `passport` and returns the web service token.
 * The private token Moodle may append is dropped: the app never needs it.
 */
export function checkRedirect(url: string, passport: string): RedirectCheck {
  const match = /^campuspulse:\/\/token=([A-Za-z0-9+/=_%-]+)/.exec(url)
  if (!match) return { ok: false, reason: 'not-a-token-redirect' }
  let encoded = match[1]
  if (encoded.includes('%')) {
    try {
      encoded = decodeURIComponent(encoded)
    } catch {
      return { ok: false, reason: 'malformed' }
    }
  }
  const decoded = decodeBase64(encoded)
  if (decoded === null) return { ok: false, reason: 'malformed' }
  const parts = decoded.split(':::')
  if (parts.length < 2 || parts.length > 3) return { ok: false, reason: 'malformed' }
  const [siteId, token] = parts
  // Both are md5 hex strings in Moodle (the token is md5 of a random value).
  if (!/^[0-9a-f]{32}$/.test(siteId) || !/^[0-9a-f]{32}$/.test(token)) {
    return { ok: false, reason: 'malformed' }
  }
  if (siteId !== md5(SITE_URL + passport)) return { ok: false, reason: 'site-mismatch' }
  return { ok: true, token }
}
