/**
 * Connecting the student's Campus Virtual account. Only the web service token is kept, in the
 * phone's secure storage; it never goes to our API and is never logged.
 *
 * The token lasts as long as UPT's "user created token duration" (Moodle's default is 12 weeks)
 * and can't be refreshed: when it stops working the student connects again.
 */
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

import { callReadOnly, CampusVirtualExpiredError } from './client'
import { checkRedirect, launchUrl, newPassport, REDIRECT_PREFIX } from './redirect'

export { CampusVirtualError, CampusVirtualExpiredError } from './client'

const TOKEN_KEY = 'campusVirtual.token'

export type SiteInfo = { fullname: string; userid: number }

export type ConnectOutcome =
  { kind: 'connected'; info: SiteInfo } | { kind: 'cancelled' } | { kind: 'refused' }

async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

/**
 * Who is connected, or null when nothing is. Throws CampusVirtualExpiredError (after forgetting
 * the token) when Campus Virtual no longer accepts it, CampusVirtualError when it can't answer.
 */
export async function getSiteInfo(): Promise<SiteInfo | null> {
  const token = await readToken()
  if (!token) return null
  try {
    const info = await callReadOnly<Partial<SiteInfo>>('core_webservice_get_site_info', token)
    return { fullname: String(info.fullname ?? ''), userid: Number(info.userid ?? 0) }
  } catch (error) {
    if (error instanceof CampusVirtualExpiredError) await disconnect()
    throw error
  }
}

/** Opens UPT's sign-in in a browser tab and keeps the token Campus Virtual sends back. */
export async function connect(): Promise<ConnectOutcome> {
  const passport = newPassport()
  const result = await WebBrowser.openAuthSessionAsync(launchUrl(passport), REDIRECT_PREFIX)
  if (result.type !== 'success' || !('url' in result)) return { kind: 'cancelled' }

  const check = checkRedirect(result.url, passport)
  if (!check.ok) return { kind: 'refused' }

  await SecureStore.setItemAsync(TOKEN_KEY, check.token)
  const info = await getSiteInfo()
  if (!info) return { kind: 'refused' }
  return { kind: 'connected', info }
}

/**
 * Forgets the token on this phone. It stays valid on UPT's side until it expires (an app can't
 * revoke it); the student can remove it under Campus Virtual → Preferences if they want it gone.
 */
export async function disconnect(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}
