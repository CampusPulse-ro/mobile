import { useTranslation } from 'react-i18next'

import type { Deadline } from '@/campusVirtual'
import { useDateTimeFormat } from '@/i18n/format'
import { addDays, campusToday } from '@/timetable/dates'

const MODULE_KEYS = {
  assign: 'deadlines.module.assign',
  quiz: 'deadlines.module.quiz',
  forum: 'deadlines.module.forum',
  data: 'deadlines.module.data',
  lesson: 'deadlines.module.lesson',
  workshop: 'deadlines.module.workshop',
  choice: 'deadlines.module.choice',
  feedback: 'deadlines.module.feedback',
  scorm: 'deadlines.module.scorm',
  h5pactivity: 'deadlines.module.h5pactivity',
  bigbluebuttonbn: 'deadlines.module.bigbluebuttonbn',
  lti: 'deadlines.module.lti',
  glossary: 'deadlines.module.glossary',
} as const

function isKnownModule(module: string): module is keyof typeof MODULE_KEYS {
  return Object.prototype.hasOwnProperty.call(MODULE_KEYS, module)
}

/** A deadline's texts in the app's language: its activity type and when it's due. */
export function useDeadlineText() {
  const { t } = useTranslation()
  const format = useDateTimeFormat()

  return {
    /** "Assignment", "Quiz"… */
    module: (deadline: Deadline) =>
      isKnownModule(deadline.module)
        ? t(MODULE_KEYS[deadline.module])
        : t('deadlines.module.other'),
    /** "Today, 23:59", "Tomorrow, 23:59", "Fri 30 October, 23:59" (campus time) */
    due: (deadline: Deadline, today: string) => {
      const day = campusToday(new Date(deadline.dueAt))
      const time = format.time(deadline.dueAt)
      if (day === today) return t('deadlines.dueToday', { time })
      if (day === addDays(today, 1)) return t('deadlines.dueTomorrow', { time })
      return t('deadlines.dueOn', {
        day: `${format.weekdayShort(deadline.dueAt)} ${format.dayMonth(deadline.dueAt)}`,
        time,
      })
    },
    /** What the date means: "Due", "Closes", "Expected to be done by". */
    dueLabel: (deadline: Deadline) =>
      deadline.eventType === 'close'
        ? t('deadlines.detail.closes')
        : deadline.eventType === 'expectcompletionon'
          ? t('deadlines.detail.expected')
          : t('deadlines.detail.due'),
  }
}
