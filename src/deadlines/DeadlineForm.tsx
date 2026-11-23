import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { ApiError, problemType } from '@/api/client'
import { BackHeader } from '@/assignments/parts'
import { Button } from '@/components/ui'
import { color, radius, space, type } from '@/theme'
import { Chip } from '@/timetable/Choice'
import {
  addDays,
  campusClock,
  campusInstant,
  campusToday,
  useMyTimetable,
  useSettings,
} from '@/timetable'

import { DueField } from './DueField'
import { DEADLINE_LIMITS, useSaveDeadline, type ManualDeadline } from './manual'

/** A new deadline is due tomorrow at 23:59 until the student picks a time. */
const DEFAULT_TIME = '23:59'

/**
 * Adding a deadline (no `deadline`) or editing one: a title, an optional course (typed, or picked
 * from the subjects in the student's timetable), when it's due, and optional notes. Saved, it goes
 * back to where it was opened from.
 */
export function DeadlineForm({ deadline }: { deadline?: ManualDeadline }) {
  const { t } = useTranslation()
  const router = useRouter()
  const save = useSaveDeadline()
  const due = deadline ? new Date(deadline.dueAt) : null
  const [title, setTitle] = useState(deadline?.title ?? '')
  const [course, setCourse] = useState(deadline?.course ?? '')
  const [date, setDate] = useState(due ? campusToday(due) : addDays(campusToday(), 1))
  const [time, setTime] = useState(due ? campusClock(due) : DEFAULT_TIME)
  const [notes, setNotes] = useState(deadline?.notes ?? '')
  const [missingTitle, setMissingTitle] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const subjects = useSubjects()

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/deadlines'))

  function submit() {
    if (save.isPending) return
    if (title.trim() === '') {
      setMissingTitle(true)
      return
    }
    setProblem(null)
    save.mutate(
      {
        id: deadline?.id,
        input: { title, course, notes, dueAt: campusInstant(date, time).toISOString() },
      },
      {
        onSuccess: leave,
        onError: (error) => {
          const kind = problemType(error)
          setProblem(
            kind === 'deadline-limit'
              ? t('deadlines.form.limit')
              : kind === 'invalid-deadline'
                ? t('deadlines.form.invalid')
                : error instanceof ApiError && error.status === 404
                  ? t('deadlines.own.gone')
                  : error instanceof ApiError
                    ? t('api.serverError')
                    : t('deadlines.own.unreachable'),
          )
        },
      },
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <BackHeader
        title={deadline ? t('deadlines.form.editTitle') : t('deadlines.form.addTitle')}
        fallback="/deadlines"
      />

      <View style={styles.field}>
        <Text style={styles.label}>{t('deadlines.form.title')}</Text>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value)
            if (value.trim() !== '') setMissingTitle(false)
          }}
          autoFocus={!deadline}
          maxLength={DEADLINE_LIMITS.title}
          placeholder={t('deadlines.form.titlePlaceholder')}
          placeholderTextColor={color.inkMuted}
          accessibilityLabel={t('deadlines.form.title')}
          style={[styles.input, missingTitle && styles.inputProblem]}
        />
        {missingTitle ? (
          <Text accessibilityLiveRegion="polite" style={styles.problem}>
            {t('deadlines.form.titleRequired')}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('deadlines.form.course')}</Text>
        <TextInput
          value={course}
          onChangeText={setCourse}
          maxLength={DEADLINE_LIMITS.course}
          placeholder={t('deadlines.form.coursePlaceholder')}
          placeholderTextColor={color.inkMuted}
          accessibilityLabel={t('deadlines.form.course')}
          style={styles.input}
        />
        {subjects.length > 0 ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('deadlines.form.pickCourse')}
            style={styles.chips}
          >
            {subjects.map((subject) => (
              <Chip
                key={subject}
                label={subject}
                selected={course.trim() === subject}
                onPress={() => setCourse(course.trim() === subject ? '' : subject)}
              />
            ))}
          </View>
        ) : null}
      </View>

      <DueField
        date={date}
        time={time}
        onChange={(nextDate, nextTime) => {
          setDate(nextDate)
          setTime(nextTime)
        }}
      />

      <View style={styles.field}>
        <Text style={styles.label}>{t('deadlines.form.notes')}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={DEADLINE_LIMITS.notes}
          textAlignVertical="top"
          placeholder={t('deadlines.form.notesPlaceholder')}
          placeholderTextColor={color.inkMuted}
          accessibilityLabel={t('deadlines.form.notes')}
          style={[styles.input, styles.notes]}
        />
      </View>

      {problem ? (
        <Text accessibilityLiveRegion="polite" style={styles.problem}>
          {problem}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={deadline ? t('deadlines.form.save') : t('deadlines.form.add')}
          busy={save.isPending}
          onPress={submit}
        />
        <Button label={t('deadlines.form.cancel')} variant="secondary" onPress={leave} />
      </View>
    </ScrollView>
  )
}

/** The subjects in the student's timetable for the next four weeks, to pick a course from. */
function useSubjects(): string[] {
  const today = campusToday()
  const settings = useSettings()
  const timetable = useMyTimetable(today, addDays(today, 27), {
    enabled: Boolean(settings.data?.studyGroup),
  })
  const names = new Set(
    (timetable.data?.occurrences ?? []).map(
      (occurrence) => occurrence.shortName || occurrence.subject,
    ),
  )
  return [...names].sort((a, b) => a.localeCompare(b, 'ro'))
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  field: { gap: space.sm },
  label: { ...type.label, color: color.ink },
  input: {
    ...type.body,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
    color: color.ink,
  },
  inputProblem: { borderColor: color.warn },
  notes: { minHeight: 96 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  problem: { ...type.bodySmall, color: color.warn },
  actions: { gap: space.sm },
})
