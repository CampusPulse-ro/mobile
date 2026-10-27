import type { AssignmentRules, SubmissionFile, SubmissionState } from '@/campusVirtual'

export type SaveInput = { text?: string; files?: SubmissionFile[] }

/**
 * Whether a stored online text holds more than plain paragraphs: other tags (bold, lists, links,
 * headings, tables), text styling, or embedded files. The app edits plain text, so saving it from
 * here keeps only its words. Paragraph alignment and direction (which Moodle's editor adds to
 * every paragraph) don't count.
 */
export function hasFormatting(html: string): boolean {
  return (
    html.includes('@@PLUGINFILE@@') ||
    /<(?!\/?(?:p|br|div|span)\b)[a-z]/i.test(html) ||
    /style\s*=\s*["'][^"']*(font-weight|font-style|text-decoration|color|background)/i.test(html)
  )
}

/**
 * What a save sends: files only when some were picked (they replace all submitted files), the text
 * only when it changed. A files-only save keeps the stored text as it is (`saveSubmission` sends it
 * back unchanged, formatting included).
 */
export function saveInput(
  rules: AssignmentRules,
  state: SubmissionState,
  draftText: string | null,
  picked: SubmissionFile[],
): { input: SaveInput; textChanged: boolean } {
  const textChanged = rules.onlineText !== null && draftText !== null && draftText !== state.text
  const sendsFiles = rules.files !== null && picked.length > 0
  return {
    input: {
      ...(textChanged && draftText !== null ? { text: draftText } : {}),
      ...(sendsFiles ? { files: picked } : {}),
    },
    textChanged,
  }
}
