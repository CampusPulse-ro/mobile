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
  allowedActions,
  checkFiles,
  checkText,
  parseAssignment,
  parseSubmissionStatus,
  saveSubmissionParams,
  submitForGradingParams,
  type AssignmentRules,
  type PickedFile,
  type SubmissionState,
} from './assign'
import {
  callReadOnly,
  callWrite,
  CampusVirtualExpiredError,
  CampusVirtualInputError,
  CampusVirtualNotAllowedError,
  uploadDraftFile,
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
  allowedActions,
  checkFiles,
  checkText,
  countWords,
  moodleText,
  type AssignmentRules,
  type FileProblem,
  type NotEditable,
  type PickedFile,
  type SubmissionState,
  type SubmissionStatus,
  type TextProblem,
} from './assign'
export {
  CampusVirtualError,
  CampusVirtualExpiredError,
  CampusVirtualInputError,
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

const VALIDATED_FOR_MS = 60_000

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
  validated?: { status: ActivityCompletion; readAt: number },
): Promise<ActivityCompletion[]> {
  const courseId = deadline.course?.id
  if (courseId === undefined || deadline.cmid === null) throw new CampusVirtualNotAllowedError()
  // A status the caller read and checked moments ago (before its confirmation) is fresh enough;
  // anything older is read again, so what's written still matches what Moodle allows.
  let status =
    validated && Date.now() - validated.readAt < VALIDATED_FOR_MS ? validated.status : null
  if (!status) {
    const before = await getCourseCompletion(courseId)
    if (before === null) throw new CampusVirtualExpiredError()
    status = completionFor(deadline, before) ?? null
  }
  if (!status || !canMarkManually(status)) throw new CampusVirtualNotAllowedError()

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

// --- assignments ---

/** `withToken` for a write: not connected is an error here, not an empty answer. */
async function connected<T>(work: (token: string) => Promise<T>): Promise<T> {
  const result = await withToken(work)
  if (result === null) throw new CampusVirtualExpiredError()
  return result
}

/** Every assignment the student can see, in every course; null when not connected. */
export function getAssignments(): Promise<AssignmentRules[] | null> {
  return withToken(async (token) => {
    const answer = await callReadOnly<{
      courses?: { fullname?: string; shortname?: string; assignments?: unknown[] }[]
    }>('mod_assign_get_assignments', token)
    return (answer.courses ?? [])
      .flatMap((course) =>
        (course.assignments ?? []).map((raw) =>
          parseAssignment(raw as Parameters<typeof parseAssignment>[0], course),
        ),
      )
      .filter((rules): rules is AssignmentRules => rules !== null)
  })
}

async function readSubmission(token: string, assignmentId: number): Promise<SubmissionState> {
  return parseSubmissionStatus(
    await callReadOnly<Parameters<typeof parseSubmissionStatus>[0]>(
      'mod_assign_get_submission_status',
      token,
      { assignid: assignmentId },
    ),
  )
}

/** The student's own submission for an assignment; null when not connected. */
export function getSubmission(assignmentId: number): Promise<SubmissionState | null> {
  return withToken((token) => readSubmission(token, assignmentId))
}

async function draftItemId(token: string): Promise<number> {
  const answer = await callReadOnly<{ itemid?: number }>(
    'core_files_get_unused_draft_itemid',
    token,
  )
  if (typeof answer.itemid !== 'number') throw new CampusVirtualExpiredError()
  return answer.itemid
}

export type SubmissionFile = PickedFile & { uri: string; mimeType: string }

/**
 * Saves the student's submission: a draft when the assignment uses drafts, otherwise it's
 * submitted. `text` replaces the online text (leaving it out keeps it: a files-only save sends the
 * stored text back unchanged); `files`, when given, replace ALL submitted files (leaving them out
 * keeps them). The caller has confirmed it with the student.
 *
 * Checked again here, from a fresh read, whatever the screen already checked: Moodle must allow
 * editing now (CampusVirtualNotAllowedError), and the text and files must fit the assignment's
 * limits (CampusVirtualInputError) — file type, count and size are not checked by Moodle's web
 * service at all. Then the files go to a private draft area, the save is sent, Moodle's warnings
 * are errors, and the submission is read again and returned.
 */
export async function saveSubmission(
  rules: AssignmentRules,
  input: { text?: string; files?: SubmissionFile[] },
): Promise<SubmissionState> {
  return connected(async (token) => {
    const before = await readSubmission(token, rules.id)
    if (!allowedActions(rules, before, Date.now()).edit) throw new CampusVirtualNotAllowedError()
    const problems = [
      ...(input.text !== undefined ? [checkText(input.text, rules)].filter((p) => p !== null) : []),
      ...(input.files !== undefined ? checkFiles(input.files, rules) : []),
    ]
    if (problems.length > 0) throw new CampusVirtualInputError(problems)
    if (input.text === undefined && input.files === undefined)
      throw new CampusVirtualInputError([{ kind: 'empty' }])

    // Files without a new text: the stored text goes back unchanged (formatting and all), or Moodle
    // refuses the save on an assignment with an online text (measured; see assign.ts).
    const keepTextHtml =
      input.text === undefined && input.files !== undefined && rules.onlineText
        ? before.textHtml
        : undefined
    const textItemId =
      rules.onlineText && (input.text !== undefined || keepTextHtml !== undefined)
        ? await draftItemId(token)
        : undefined
    let filesItemId: number | undefined
    if (input.files !== undefined && rules.files) {
      filesItemId = await draftItemId(token)
      for (const file of input.files) await uploadDraftFile(token, filesItemId, file)
    }
    await callWrite(
      'mod_assign_save_submission',
      token,
      saveSubmissionParams(rules, { text: input.text, keepTextHtml, textItemId, filesItemId }),
    )
    return readSubmission(token, rules.id)
  })
}

/**
 * Submits the saved draft for grading: after this the student can't change it. The caller has
 * confirmed it twice. Checked again from a fresh read that Moodle offers it, and that the
 * statement was accepted when the assignment requires one.
 */
export async function submitForGrading(
  rules: AssignmentRules,
  acceptStatement: boolean,
): Promise<SubmissionState> {
  return connected(async (token) => {
    const before = await readSubmission(token, rules.id)
    if (!allowedActions(rules, before, Date.now()).submitForGrading) {
      throw new CampusVirtualNotAllowedError()
    }
    if (rules.statement !== null && !acceptStatement) {
      throw new CampusVirtualInputError([{ kind: 'statement' }])
    }
    await callWrite(
      'mod_assign_submit_for_grading',
      token,
      submitForGradingParams(rules, acceptStatement),
    )
    return readSubmission(token, rules.id)
  })
}
