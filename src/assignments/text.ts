import { useTranslation } from 'react-i18next'

import {
  CampusVirtualError,
  CampusVirtualExpiredError,
  CampusVirtualInputError,
  CampusVirtualNotAllowedError,
  CampusVirtualWriteError,
  moodleText,
  type AssignmentRules,
  type FileProblem,
  type NotEditable,
  type SubmissionState,
  type TextProblem,
} from '@/campusVirtual'
import { isLanguage } from '@/i18n'
import { formatDateTime, useDateTimeFormat } from '@/i18n/format'
import { addDays, campusToday } from '@/timetable/dates'

/** What the student is told after a write (or a refused one). */
export type Outcome = { ok: boolean; text: string }

type InputProblem = TextProblem | FileProblem | { kind: 'empty' } | { kind: 'statement' }

const KB = 1024

/** An assignment's texts in the app's language: dates, statuses, limits, problems, outcomes. */
export function useAssignmentText() {
  const { t, i18n } = useTranslation()
  const format = useDateTimeFormat()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
  const year = (value: number) => formatDateTime(value, { year: 'numeric' }, language)
  // The year only when it isn't this one's: an old course's assignments stay readable.
  const withYear = (day: string, value: number, now: number) =>
    year(value) === year(now) ? day : `${day} ${year(value)}`
  const number = (value: number) =>
    new Intl.NumberFormat(language === 'ro' ? 'ro-RO' : 'en-GB', {
      maximumFractionDigits: 1,
    }).format(value)

  const size = (bytes: number) => {
    if (bytes < KB) return t('assignments.size.b', { n: number(bytes) })
    if (bytes < KB * KB) return t('assignments.size.kb', { n: number(bytes / KB) })
    if (bytes < KB * KB * KB) return t('assignments.size.mb', { n: number(bytes / KB / KB) })
    return t('assignments.size.gb', { n: number(bytes / KB / KB / KB) })
  }

  const problem = (p: InputProblem): string => {
    switch (p.kind) {
      case 'empty':
        return t('assignments.problem.empty')
      case 'statement':
        return t('assignments.problem.statement')
      case 'tooManyWords':
        return t('assignments.problem.tooManyWords', { words: p.words, limit: p.limit })
      case 'tooMany':
        return t('assignments.problem.tooMany', { max: p.max })
      case 'tooBig':
        return t('assignments.problem.tooBig', { size: size(p.maxBytes) })
      case 'unknownSize':
        return t('assignments.problem.unknownSize')
      case 'wrongType':
        return t('assignments.problem.wrongType', { types: p.types.join(', ') })
    }
  }

  /** "Wednesday 14 October, 23:59" (campus time), with the year when it isn't this year. */
  const when = (value: number, now: number) =>
    t('assignments.when.day', {
      day: withYear(format.date(value), value, now),
      time: format.time(value),
    })

  return {
    size,
    when,
    /** "today, 23:59", "tomorrow, 23:59", "Fri 30 October, 23:59": for a list row. */
    whenShort: (value: number, now: number) => {
      const today = campusToday(new Date(now))
      const day = campusToday(new Date(value))
      const time = format.time(value)
      if (day === today) return t('assignments.when.today', { time })
      if (day === addDays(today, 1)) return t('assignments.when.tomorrow', { time })
      const short = `${format.weekdayShort(value)} ${format.dayMonth(value)}`
      return t('assignments.when.day', { day: withYear(short, value, now), time })
    },
    course: (rules: AssignmentRules) =>
      rules.courseName || t('assignments.courseN', { id: rules.courseId }),
    status: (state: SubmissionState) => {
      switch (state.status) {
        case 'draft':
          return t('assignments.status.draft')
        case 'submitted':
          return t('assignments.status.submitted')
        case 'reopened':
          return t('assignments.status.reopened')
        default:
          return t('assignments.status.none')
      }
    },
    /** Why there's nothing to edit, in one line. */
    reason: (reason: NotEditable, rules: AssignmentRules, state: SubmissionState, now: number) => {
      const closesAt = state.extensionDueAt ?? rules.cutoffAt
      switch (reason) {
        case 'notOpen':
          return rules.opensAt !== null
            ? t('assignments.reason.notOpen', { when: when(rules.opensAt, now) })
            : t('assignments.reason.notAllowed')
        case 'closed':
          return closesAt !== null
            ? t('assignments.reason.closed', { when: when(closesAt, now) })
            : t('assignments.reason.notAllowed')
        case 'submitted':
          return t('assignments.reason.submitted')
        case 'locked':
          return t('assignments.reason.locked')
        case 'nothingToSubmit':
          return t('assignments.reason.nothingToSubmit')
        case 'notAllowed':
          return t('assignments.reason.notAllowed')
      }
    },
    /** "Up to 2 files · 1 MB each · .pdf" */
    limits: (files: NonNullable<AssignmentRules['files']>) =>
      [
        files.maxFiles === 1
          ? t('assignments.limits.one')
          : t('assignments.limits.many', { n: files.maxFiles }),
        files.maxBytes > 0 ? t('assignments.limits.size', { size: size(files.maxBytes) }) : null,
        files.types.length > 0 ? files.types.join(', ') : t('assignments.limits.anyType'),
      ]
        .filter(Boolean)
        .join(' · '),
    /** A problem with the text or the files; a file's own row already names the file. */
    problem,
    /** The read before a confirmation failed: nothing was sent. */
    failureBefore: (error: unknown): Outcome => {
      if (error instanceof CampusVirtualExpiredError) {
        return { ok: false, text: t('assignments.outcome.expiredBefore') }
      }
      if (error instanceof CampusVirtualError && error.kind === 'rejected') {
        return {
          ok: false,
          text: t('assignments.outcome.rejectedBefore', {
            reason: error.detail ? moodleText(error.detail) : error.code,
          }),
        }
      }
      return { ok: false, text: t('assignments.outcome.unreachableBefore') }
    },
    /** Why a write didn't happen, or may not have: what the student is shown. */
    failure: (error: unknown): Outcome => {
      if (error instanceof CampusVirtualNotAllowedError) {
        return { ok: false, text: t('assignments.outcome.notAllowed') }
      }
      if (error instanceof CampusVirtualInputError) {
        const texts = error.problems.map((p) => {
          const known = p as InputProblem
          const text = problem(known)
          return 'name' in known ? `${known.name}: ${text}` : text
        })
        return { ok: false, text: t('assignments.outcome.input', { problems: texts.join(' ') }) }
      }
      if (error instanceof CampusVirtualExpiredError) {
        return { ok: false, text: t('assignments.outcome.expired') }
      }
      if (error instanceof CampusVirtualWriteError) {
        return {
          ok: false,
          text:
            error.reasons.length > 0
              ? t('assignments.outcome.failedReason', { reason: error.reasons.join(' ') })
              : t('assignments.outcome.failed'),
        }
      }
      if (error instanceof CampusVirtualError && error.kind === 'rejected') {
        return {
          ok: false,
          text: t('assignments.outcome.rejected', {
            reason: error.detail ? moodleText(error.detail) : error.code,
          }),
        }
      }
      return { ok: false, text: t('assignments.outcome.unreachable') }
    },
  }
}
