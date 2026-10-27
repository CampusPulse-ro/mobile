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

import {
  canMarkManually,
  completionFor,
  parseCompletion,
  parseDeadlines,
  type ActivityCompletion,
  type Deadline,
} from './activities'
import {
  callReadOnly,
  callWrite,
  CampusVirtualExpiredError,
  CampusVirtualNotAllowedError,
} from './client'
import { checkRedirect, launchUrl, newPassport, REDIRECT_PREFIX } from './redirect'

export {
  canMarkManually,
  completionFor,
  isDone,
  type ActivityCompletion,
  type Deadline,
} from './activities'
export {
  CampusVirtualError,
  CampusVirtualExpiredError,
  CampusVirtualNotAllowedError,
  CampusVirtualWriteError,
} from './client'

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
// The connected student's Moodle user id, once known (completion calls need it). Not secret.
let knownUserId: number | null = null

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
    const userid = Number(info.userid ?? 0)
    knownUserId = userid > 0 ? userid : null
    return { fullname: String(info.fullname ?? ''), userid }
  } catch (error) {
    if (error instanceof CampusVirtualExpiredError) await disconnect()
    throw error
  }
}

/** Runs `work` with the stored token; null when nothing is connected. Forgets an expired token. */
async function withToken<T>(work: (token: string) => Promise<T>): Promise<T | null> {
  const token = await readToken()
  if (!token) return null
  try {
    return await work(token)
  } catch (error) {
    if (error instanceof CampusVirtualExpiredError) await disconnect()
    throw error
  }
}

const DAY_SECONDS = 24 * 60 * 60

/**
 * The student's deadlines from `from` (default: now) to 14 days later, soonest first; null when
 * Campus Virtual isn't connected.
 */
export function getDeadlines(from: Date = new Date()): Promise<Deadline[] | null> {
  const timesortfrom = Math.floor(from.getTime() / 1000)
  return withToken(async (token) =>
    parseDeadlines(
      await callReadOnly<unknown>('core_calendar_get_action_events_by_timesort', token, {
        timesortfrom,
        timesortto: timesortfrom + 14 * DAY_SECONDS,
        limitnum: 20,
      }),
    ),
  )
}

async function userId(): Promise<number> {
  if (knownUserId !== null) return knownUserId
  const info = await getSiteInfo()
  if (!info || info.userid <= 0) throw new CampusVirtualExpiredError()
  return info.userid
}

/** The completion status of every activity in a course; null when nothing is connected. */
export function getCourseCompletion(courseId: number): Promise<ActivityCompletion[] | null> {
  return withToken(async (token) =>
    parseCompletion(
      await callReadOnly<unknown>('core_completion_get_activities_completion_status', token, {
        courseid: courseId,
        userid: await userId(),
      }),
    ),
  )
}

/**
 * Marks an activity done (or not done) on Campus Virtual: the app's first write. The caller has
 * already confirmed it with the student. Checks first, from a fresh read, that Moodle allows it
 * (manual completion, not locked: CampusVirtualNotAllowedError otherwise); throws
 * CampusVirtualWriteError when Moodle answers but doesn't make the change. Returns the course's
 * statuses, read again after the write.
 */
export async function setManualCompletion(
  deadline: Deadline,
  done: boolean,
): Promise<ActivityCompletion[]> {
  const courseId = deadline.course?.id
  if (courseId === undefined || deadline.cmid === null) throw new CampusVirtualNotAllowedError()
  const before = await getCourseCompletion(courseId)
  if (before === null) throw new CampusVirtualExpiredError()
  const status = completionFor(deadline, before)
  if (!canMarkManually(status)) throw new CampusVirtualNotAllowedError()

  await withToken((token) =>
    callWrite('core_completion_update_activity_completion_status_manually', token, {
      cmid: status.cmid,
      completed: done ? 1 : 0,
    }),
  )
  const after = await getCourseCompletion(courseId)
  if (after === null) throw new CampusVirtualExpiredError()
  return after
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
  knownUserId = null
  const info = await getSiteInfo()
  if (!info) return { kind: 'refused' }
  return { kind: 'connected', info }
}

/**
 * Forgets the token on this phone. It stays valid on UPT's side until it expires: an app can't
 * revoke it, and students have no page to do it either.
 */
export async function disconnect(): Promise<void> {
  knownUserId = null
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTIONS)
  } catch {
    // Nothing stored, or the store is unavailable: either way nothing is kept.
  }
}
