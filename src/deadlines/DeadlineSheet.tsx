import { useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  CampusVirtualError,
  CampusVirtualExpiredError,
  CampusVirtualNotAllowedError,
  CampusVirtualWriteError,
  canMarkManually,
  completionFor,
  isDone,
  type Deadline,
} from '@/campusVirtual'
import { Button } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'

import { freshCourseCompletion, useCourseCompletion, useSetCompletion } from './api'
import { useDeadlineText } from './text'

/**
 * A deadline's details in a bottom sheet (the same sheet as a class's): the activity, its course
 * and type, when it's due, what to do, a link to Campus Virtual and, when the activity's completion
 * is the student's to tick, "Mark as done". Open while `deadline` is set; `onClose` clears it.
 */
export function DeadlineSheet({
  deadline,
  onClose,
}: {
  deadline: Deadline | null
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  // Keep the last deadline on screen while the sheet slides away.
  const [shown, setShown] = useState(deadline)
  if (deadline && deadline !== shown) setShown(deadline)

  return (
    <Modal
      visible={deadline !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          importantForAccessibility="no"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          {shown ? <Details key={shown.id} deadline={shown} onClose={onClose} /> : null}
        </View>
      </View>
    </Modal>
  )
}

function Details({ deadline, onClose }: { deadline: Deadline; onClose: () => void }) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const text = useDeadlineText()
  const url = deadline.url

  const open = (link: string) => {
    void WebBrowser.openBrowserAsync(link).catch(() => Linking.openURL(link))
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {deadline.activityName}
        </Text>
        {deadline.course?.fullName ? (
          <Text style={styles.subtitle}>{deadline.course.fullName}</Text>
        ) : null}
      </View>

      <Field value={text.module(deadline)} label={t('deadlines.detail.type')} />
      <Field value={format.dateTime(deadline.dueAt)} label={text.dueLabel(deadline)} />
      {deadline.overdue ? (
        <View style={styles.overdue}>
          <Text style={styles.overdueText}>{t('deadlines.overdue')}</Text>
        </View>
      ) : null}
      {deadline.actionName ? (
        <Field value={deadline.actionName} label={t('deadlines.detail.action')} />
      ) : null}

      <Completion deadline={deadline} />

      <View style={styles.actions}>
        {url ? <Button label={t('deadlines.detail.open')} onPress={() => open(url)} /> : null}
        <Button label={t('deadlines.detail.close')} variant="secondary" onPress={onClose} />
      </View>
    </ScrollView>
  )
}

type Outcome = { ok: boolean; text: string }

/**
 * "Mark as done" / "Mark as not done", only when Moodle says the student may tick this activity
 * (manual completion, not automatic, not overridden by a teacher, the student tracked). The
 * confirmation is built from a fresh status; the write re-checks it, and its answer and the status
 * read after it decide what the student is told.
 */
function Completion({ deadline }: { deadline: Deadline }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const courseId = deadline.course?.id ?? null
  const completion = useCourseCompletion(courseId)
  const setCompletion = useSetCompletion()
  const [checking, setChecking] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const status = completionFor(deadline, completion.data ?? [])
  const allowed = canMarkManually(status)
  if (!allowed && !outcome) return null

  const course = deadline.course?.fullName || deadline.course?.shortName || ''
  const busy = checking || setCompletion.isPending

  const failure = (error: unknown): Outcome => {
    if (error instanceof CampusVirtualNotAllowedError) {
      return { ok: false, text: t('deadlines.completion.notAllowed') }
    }
    if (error instanceof CampusVirtualExpiredError) {
      return { ok: false, text: t('deadlines.expired') }
    }
    if (error instanceof CampusVirtualWriteError) {
      return {
        ok: false,
        text:
          error.reasons.length > 0
            ? t('deadlines.completion.failedReason', { reason: error.reasons.join(' ') })
            : t('deadlines.completion.failed'),
      }
    }
    if (error instanceof CampusVirtualError && error.kind === 'rejected') {
      return {
        ok: false,
        text: t('deadlines.completion.failedReason', { reason: error.detail ?? error.code }),
      }
    }
    return { ok: false, text: t('deadlines.completion.unreachable') }
  }

  const write = (done: boolean) => {
    setCompletion.mutate(
      { deadline, done },
      {
        onSuccess: (statuses) => {
          const after = completionFor(deadline, statuses)
          setOutcome(
            after && isDone(after) === done
              ? {
                  ok: true,
                  text: done
                    ? t('deadlines.completion.savedDone')
                    : t('deadlines.completion.savedNotDone'),
                }
              : { ok: false, text: t('deadlines.completion.notRecorded') },
          )
        },
        onError: (error) => setOutcome(failure(error)),
      },
    )
  }

  const confirm = async () => {
    if (busy || courseId === null) return
    setOutcome(null)
    setChecking(true)
    // The cached status may be old: what the student confirms is what Moodle says now.
    const read = await freshCourseCompletion(queryClient, courseId).then(
      (statuses) => ({ fresh: completionFor(deadline, statuses ?? []) }),
      (error: unknown) => {
        setOutcome(failure(error))
        return null
      },
    )
    setChecking(false)
    if (!read) return
    const { fresh } = read
    if (!canMarkManually(fresh)) {
      setOutcome({ ok: false, text: t('deadlines.completion.notAllowed') })
      return
    }
    const done = !isDone(fresh)
    const values = { name: deadline.activityName, course }
    Alert.alert(
      done
        ? t('deadlines.completion.confirmTitleDone')
        : t('deadlines.completion.confirmTitleNotDone'),
      done
        ? t('deadlines.completion.confirmDone', values)
        : t('deadlines.completion.confirmNotDone', values),
      [
        { text: t('deadlines.completion.cancel'), style: 'cancel', isPreferred: true },
        {
          text: done ? t('deadlines.completion.markDone') : t('deadlines.completion.markNotDone'),
          onPress: () => write(done),
        },
      ],
      { cancelable: true },
    )
  }

  return (
    <View style={styles.completion}>
      {status && allowed ? (
        <>
          <Field
            value={
              isDone(status) ? t('deadlines.completion.done') : t('deadlines.completion.notDone')
            }
            label={t('deadlines.detail.completion')}
          />
          <Button
            label={
              isDone(status)
                ? t('deadlines.completion.markNotDone')
                : t('deadlines.completion.markDone')
            }
            variant="secondary"
            busy={busy}
            onPress={() => void confirm()}
          />
        </>
      ) : null}
      {outcome ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.outcome, outcome.ok ? styles.outcomeOk : styles.outcomeFailed]}
        >
          {outcome.text}
        </Text>
      ) : null}
    </View>
  )
}

function Field({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.field} accessible>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: color.sunken, opacity: 0.75 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: color.raised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.line,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.lineStrong,
  },
  content: { padding: space.xl, gap: space.lg },
  header: { gap: space.xs },
  title: { ...type.heading, color: color.ink },
  subtitle: { ...type.bodySmall, color: color.inkMuted },
  field: { gap: 2 },
  value: { ...type.body, color: color.ink },
  label: { ...type.caption, color: color.inkMuted },
  overdue: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.warn,
  },
  overdueText: { ...type.caption, color: color.warn },
  completion: { gap: space.md },
  outcome: { ...type.bodySmall },
  outcomeOk: { color: color.success },
  outcomeFailed: { color: color.warn },
  actions: { gap: space.sm, marginTop: space.sm },
})
