/**
 * Assignments on Campus Virtual: the pure part. Parsing Moodle's answers, deciding what the student
 * may do, checking what they want to send, and building the write calls' parameters. No network,
 * no storage, no React Native, so it runs as is against a test Moodle (`.bench/` harness).
 *
 * Measured on Moodle 5.2 (cv.upt.ro's version), and the reason for each check here:
 * - the word limit is enforced by Moodle, but file type, count and size are NOT through the web
 *   service (a .txt was stored in a PDF-only assignment): the app checks them before uploading;
 * - saving files replaces the whole set; saving without `files_filemanager` keeps the files;
 * - but saving without the online text fails (`dmlwriteexception`) when the assignment has one:
 *   Moodle saves every enabled part, and a missing text counts as an empty one. A files-only save
 *   sends the stored text back exactly as it is (`keepTextHtml`);
 * - submitting for grading without the required statement fails; after it, `canedit` is false;
 * - `mod_assign_save_submission` and `mod_assign_submit_for_grading` answer with a list of
 *   warnings, empty on success. Warning messages are HTML, escaped.
 */

export type AssignmentRules = {
  id: number
  cmid: number
  courseId: number
  /** The course's full name (its short name when it has none); '' when the answer doesn't say. */
  courseName: string
  name: string
  /** Milliseconds since the epoch, or null when not set. */
  opensAt: number | null
  dueAt: number | null
  cutoffAt: number | null
  /** Drafts on: saving keeps a draft, "submit for grading" is a separate step. */
  drafts: boolean
  statement: string | null
  onlineText: { wordLimit: number | null } | null
  /**
   * `types`: accepted extensions (".pdf"), empty = any. `unknownTypes`: the teacher's list holds a
   * type the app can't turn into extensions, so it can't check files and doesn't upload any.
   */
  files: { maxFiles: number; maxBytes: number; types: string[]; unknownTypes: boolean } | null
}

export type SubmissionStatus = 'none' | 'new' | 'draft' | 'submitted' | 'reopened'

export type SubmittedFile = {
  name: string
  bytes: number
  url: string | null
  mimetype: string | null
}

export type SubmissionState = {
  status: SubmissionStatus
  canEdit: boolean
  canSubmit: boolean
  locked: boolean
  graded: boolean
  gradingStatus: string | null
  modifiedAt: number | null
  extensionDueAt: number | null
  /** The online text as Moodle stores it (HTML), and as plain text for editing. */
  textHtml: string
  text: string
  files: SubmittedFile[]
}

type RawConfig = { plugin?: string; subtype?: string; name?: string; value?: string }
type RawAssignment = {
  id?: number
  cmid?: number
  course?: number
  name?: string
  allowsubmissionsfromdate?: number
  duedate?: number
  cutoffdate?: number
  submissiondrafts?: number
  requiresubmissionstatement?: number
  submissionstatement?: string
  configs?: RawConfig[]
}
/** The course an assignment came in (`courses[]` of the same answer). */
type RawCourse = { fullname?: string; shortname?: string }

const ms = (seconds: number | undefined) => (seconds ? seconds * 1000 : null)

/** One assignment from `mod_assign_get_assignments` (`courses[].assignments[]`), and its course. */
export function parseAssignment(raw: RawAssignment, course?: RawCourse): AssignmentRules | null {
  if (typeof raw.id !== 'number' || typeof raw.cmid !== 'number') return null
  const config = (plugin: string, name: string) =>
    raw.configs?.find(
      (c) => c.subtype === 'assignsubmission' && c.plugin === plugin && c.name === name,
    )?.value
  const on = (plugin: string) => config(plugin, 'enabled') === '1'
  const wordLimit = Number(config('onlinetext', 'wordlimit')) || 0
  return {
    id: raw.id,
    cmid: raw.cmid,
    courseId: raw.course ?? 0,
    courseName: moodleText(course?.fullname ?? '') || moodleText(course?.shortname ?? ''),
    name: moodleText(raw.name ?? ''),
    opensAt: ms(raw.allowsubmissionsfromdate),
    dueAt: ms(raw.duedate),
    cutoffAt: ms(raw.cutoffdate),
    drafts: raw.submissiondrafts === 1,
    statement:
      raw.requiresubmissionstatement === 1 ? moodleText(raw.submissionstatement ?? '') || '' : null,
    onlineText: on('onlinetext')
      ? {
          wordLimit:
            config('onlinetext', 'wordlimitenabled') === '1' && wordLimit > 0 ? wordLimit : null,
        }
      : null,
    files: on('file')
      ? {
          maxFiles: Number(config('file', 'maxfilesubmissions')) || 1,
          maxBytes: Number(config('file', 'maxsubmissionsizebytes')) || 0,
          ...fileTypes(config('file', 'filetypeslist') ?? ''),
        }
      : null,
  }
}

/**
 * Moodle's type groups (`core_filetypes`), only the common ones and only the extensions of each that
 * Moodle lists: a group missing here makes the list unknown (no uploads from the app), never "any".
 */
const TYPE_GROUPS: Record<string, string[]> = {
  document: ['.doc', '.docx', '.epub', '.gdoc', '.odm', '.odt', '.oth', '.ott', '.pdf', '.rtf'],
  image: [
    '.bmp',
    '.gif',
    '.ico',
    '.jpe',
    '.jpeg',
    '.jpg',
    '.png',
    '.svg',
    '.svgz',
    '.tif',
    '.tiff',
    '.webp',
  ],
  web_image: ['.gif', '.jpe', '.jpeg', '.jpg', '.png', '.svg', '.svgz', '.webp'],
  audio: [
    '.aac',
    '.aif',
    '.aifc',
    '.aiff',
    '.flac',
    '.m4a',
    '.mp3',
    '.oga',
    '.ogg',
    '.wav',
    '.wma',
  ],
  video: ['.3gp', '.avi', '.flv', '.m4v', '.mov', '.mp4', '.mpeg', '.mpg', '.ogv', '.webm', '.wmv'],
  archive: ['.7z', '.gz', '.gzip', '.rar', '.tar', '.tgz', '.zip'],
  spreadsheet: ['.csv', '.ods', '.ots', '.xls', '.xlsm', '.xlsx'],
  presentation: ['.odp', '.otp', '.pps', '.ppsx', '.ppt', '.pptm', '.pptx'],
}

const MIME_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpe', '.jpeg', '.jpg'],
  'image/png': ['.png'],
  'text/plain': ['.txt'],
}

/** Moodle's accepted-types list (extensions, groups, MIME types) as extensions. */
export function fileTypes(list: string): { types: string[]; unknownTypes: boolean } {
  const types = new Set<string>()
  let unknownTypes = false
  for (const token of list
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)) {
    if (token === '*') return { types: [], unknownTypes: false }
    const known = token.startsWith('.') ? [token] : (TYPE_GROUPS[token] ?? MIME_EXTENSIONS[token])
    if (known) known.forEach((type) => types.add(type))
    else unknownTypes = true
  }
  return { types: [...types], unknownTypes }
}

type RawFile = { filename?: string; filesize?: number; fileurl?: string; mimetype?: string }
type RawPlugin = {
  type?: string
  editorfields?: { text?: string }[]
  fileareas?: { files?: RawFile[] }[]
}
type RawStatus = {
  lastattempt?: {
    submission?: { status?: string; timemodified?: number; plugins?: RawPlugin[] }
    canedit?: boolean
    cansubmit?: boolean
    locked?: boolean
    graded?: boolean
    gradingstatus?: string
    extensionduedate?: number | null
  }
}

/** `mod_assign_get_submission_status` for the student's own submission. */
export function parseSubmissionStatus(raw: RawStatus): SubmissionState {
  const last = raw.lastattempt ?? {}
  const submission = last.submission
  const plugins = submission?.plugins ?? []
  const textHtml =
    plugins
      .find((p) => p.type === 'onlinetext')
      ?.editorfields?.map((f) => f.text ?? '')
      .join('') ?? ''
  const files = (plugins.find((p) => p.type === 'file')?.fileareas ?? []).flatMap((area) =>
    (area.files ?? []).map((f) => ({
      name: f.filename ?? '',
      bytes: f.filesize ?? 0,
      url: f.fileurl ?? null,
      mimetype: f.mimetype ?? null,
    })),
  )
  const status = submission?.status
  return {
    status:
      status === 'new' || status === 'draft' || status === 'submitted' || status === 'reopened'
        ? status
        : 'none',
    canEdit: last.canedit === true,
    canSubmit: last.cansubmit === true,
    locked: last.locked === true,
    graded: last.graded === true,
    gradingStatus: last.gradingstatus ?? null,
    modifiedAt: ms(submission?.timemodified),
    extensionDueAt: ms(last.extensionduedate ?? undefined),
    textHtml,
    text: htmlToText(textHtml),
    files,
  }
}

export type NotEditable =
  'notOpen' | 'closed' | 'submitted' | 'locked' | 'nothingToSubmit' | 'notAllowed'

/**
 * What the student may do now, from Moodle's own answer (`canedit`, `cansubmit`) plus the dates
 * and settings, so the app never offers a write Moodle would refuse. `reason` says why not.
 */
export function allowedActions(
  rules: AssignmentRules,
  state: SubmissionState,
  now: number,
): { edit: boolean; submitForGrading: boolean; reason: NotEditable | null } {
  const submitForGrading =
    rules.drafts && state.canSubmit && state.status === 'draft' && !state.locked
  let reason: NotEditable | null = null
  if (!rules.onlineText && !rules.files) reason = 'nothingToSubmit'
  else if (state.locked) reason = 'locked'
  else if (rules.opensAt !== null && now < rules.opensAt) reason = 'notOpen'
  else if (rules.cutoffAt !== null && now > (state.extensionDueAt ?? rules.cutoffAt))
    reason = 'closed'
  else if (!state.canEdit) reason = state.status === 'submitted' ? 'submitted' : 'notAllowed'
  return { edit: reason === null, submitForGrading, reason }
}

/** Words as Moodle counts them (`count_words`): apostrophes and dashes join, `_` splits, 1.5 is one. */
export function countWords(text: string): number {
  const plain = text
    .replace(/_/g, ' ')
    .replace(/['"’-]/g, '')
    .replace(/([0-9])[.,]([0-9])/g, '$1$2')
  return plain.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
}

export type TextProblem = { kind: 'empty' } | { kind: 'tooManyWords'; words: number; limit: number }

export function checkText(text: string, rules: AssignmentRules): TextProblem | null {
  if (!rules.onlineText) return null
  const words = countWords(text)
  const limit = rules.onlineText.wordLimit
  if (limit !== null && words > limit) return { kind: 'tooManyWords', words, limit }
  return null
}

export type PickedFile = { name: string; bytes: number | null; mimeType: string | null }

export type FileProblem =
  | { kind: 'typesUnknown' }
  | { kind: 'tooMany'; max: number }
  | { kind: 'tooBig'; name: string; maxBytes: number }
  | { kind: 'unknownSize'; name: string }
  | { kind: 'wrongType'; name: string; types: string[] }

/** Type, size and count, which Moodle's web service doesn't check (measured). */
export function checkFiles(files: PickedFile[], rules: AssignmentRules): FileProblem[] {
  const limits = rules.files
  if (!limits) return []
  const problems: FileProblem[] = []
  if (files.length > 0 && limits.unknownTypes) return [{ kind: 'typesUnknown' }]
  if (files.length > limits.maxFiles) problems.push({ kind: 'tooMany', max: limits.maxFiles })
  for (const file of files) {
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : ''
    if (limits.types.length > 0 && !limits.types.includes(extension)) {
      problems.push({ kind: 'wrongType', name: file.name, types: limits.types })
    }
    if (file.bytes === null) problems.push({ kind: 'unknownSize', name: file.name })
    else if (limits.maxBytes > 0 && file.bytes > limits.maxBytes) {
      problems.push({ kind: 'tooBig', name: file.name, maxBytes: limits.maxBytes })
    }
  }
  return problems
}

/**
 * `mod_assign_save_submission`'s parameters. `textItemId`/`filesItemId` are draft areas from
 * `core_files_get_unused_draft_itemid`; leaving `filesItemId` out keeps the submitted files.
 */
export function saveSubmissionParams(
  rules: AssignmentRules,
  input: { text?: string; keepTextHtml?: string; textItemId?: number; filesItemId?: number },
): Record<string, string | number> {
  const params: Record<string, string | number> = { assignmentid: rules.id }
  const html = input.text !== undefined ? textToHtml(input.text) : input.keepTextHtml
  if (rules.onlineText && html !== undefined && input.textItemId !== undefined) {
    params['plugindata[onlinetext_editor][text]'] = html
    params['plugindata[onlinetext_editor][format]'] = 1 // FORMAT_HTML
    params['plugindata[onlinetext_editor][itemid]'] = input.textItemId
  }
  if (rules.files && input.filesItemId !== undefined) {
    params['plugindata[files_filemanager]'] = input.filesItemId
  }
  return params
}

export function submitForGradingParams(
  rules: AssignmentRules,
  acceptStatement: boolean,
): Record<string, number> {
  return { assignmentid: rules.id, acceptsubmissionstatement: acceptStatement ? 1 : 0 }
}

/**
 * Whether an online text has files embedded in it (images pasted on the website). Any save from the
 * app would drop them: the app can't carry them into a new draft area. Such a submission is
 * changed on Campus Virtual only.
 */
export function hasEmbeddedFiles(html: string): boolean {
  return html.includes('@@PLUGINFILE@@')
}

/** Plain text the student typed, as the HTML Moodle stores: escaped, one paragraph per line. */
export function textToHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '' : `<p>${escape(line)}</p>`))
    .filter(Boolean)
    .join('')
}

/** Moodle's HTML (an online text) as editable plain text: one line per paragraph or break. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A Moodle string or warning (HTML, sometimes escaped twice) as plain text for the screen. */
export function moodleText(value: string): string {
  let text = value
  for (let i = 0; i < 2 && /&(lt|gt|amp|quot|#\d+);/.test(text); i++) text = decodeEntities(text)
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
