/**
 * Connecting the student's Campus Virtual account. Only the web service token is kept, in the
 * phone's secure storage; it never goes to our API and is never logged.
 *
 * It is the SAME token the official Moodle app holds for this student (Moodle keeps one per user),
 * so it expires when that one does: UPT's "user created token duration" (Moodle's default is 12
 * weeks), counted from whichever app connected first. It can't be refreshed, and a student can't
 * revoke it themselves; when it stops working the student connects again.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

import { callReadOnly, CampusVirtualExpiredError } from './client'
import { checkRedirect, launchUrl, newPassport, REDIRECT_PREFIX } from './redirect'

export { CampusVirtualError, CampusVirtualExpiredError } from './client'

const TOKEN_KEY = 'campusVirtual.token'
// This device only, never in an iCloud/device backup. No requireAuthentication: the app reads
// the token in the background without a biometric prompt.
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
// iOS keeps keychain items across an uninstall. The first run of an install deletes any token a
// previous install left behind, so a reinstall starts disconnected.
const INSTALL_MARKER = 'campusVirtual.installed'

export type SiteInfo = { fullname: string; userid: number }

export type ConnectOutcome =
  { kind: 'connected'; info: SiteInfo } | { kind: 'cancelled' } | { kind: 'refused' }

let freshInstallCheck: Promise<void> | null = null

function forgetLeftoverToken(): Promise<void> {
  freshInstallCheck ??= (async () => {
    try {
      if ((await AsyncStorage.getItem(INSTALL_MARKER)) === null) {
        await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTIONS)
        await AsyncStorage.setItem(INSTALL_MARKER, '1')
      }
    } catch {
      // Storage unavailable: nothing to clean up that we could read anyway.
    }
  })()
  return freshInstallCheck
}

async function readToken(): Promise<string | null> {
  await forgetLeftoverToken()
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, STORE_OPTIONS)
  } catch {
    // An entry that can't be read (e.g. the key changed after a restore) would fail forever:
    // drop it and start disconnected.
    await disconnect()
    return null
  }
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
  await forgetLeftoverToken()
  const passport = newPassport()
  const result = await WebBrowser.openAuthSessionAsync(launchUrl(passport), REDIRECT_PREFIX)
  if (result.type !== 'success' || !('url' in result)) return { kind: 'cancelled' }

  const check = checkRedirect(result.url, passport)
  if (!check.ok) return { kind: 'refused' }

  await SecureStore.setItemAsync(TOKEN_KEY, check.token, STORE_OPTIONS)
  const info = await getSiteInfo()
  if (!info) return { kind: 'refused' }
  return { kind: 'connected', info }
}

/**
 * Forgets the token on this phone. It stays valid on UPT's side until it expires: an app can't
 * revoke it, and students have no page to do it either.
 */
export async function disconnect(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTIONS)
  } catch {
    // Nothing stored, or the store is unavailable: either way nothing is kept.
  }
}
