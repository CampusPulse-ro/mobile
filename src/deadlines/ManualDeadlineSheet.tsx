import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/client'
import { BottomSheet, SheetField } from '@/components/BottomSheet'
import { Button } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import { useNow } from '@/timetable/classes'

import { useDeleteDeadline, useSetDeadlineDone, type ManualDeadline } from './manual'

/**
 * A deadline the student added, in the same bottom sheet as Campus Virtual's: what, when, the
 * notes, and "Mark as done", "Edit", "Delete". Open while `deadline` is set; `onClose` clears it.
 * Pass the cached copy (looked up by id in `useManualDeadlines`), so a change made here shows at once.
 */
export function ManualDeadlineSheet({
  deadline,
  onClose,
}: {
  deadline: ManualDeadline | null
  onClose: () => void
}) {
  return (
    <BottomSheet item={deadline} onClose={onClose}>
      {(shown) => <Details key={shown.id} deadline={shown} onClose={onClose} />}
    </BottomSheet>
  )
}

function Details({ deadline, onClose }: { deadline: ManualDeadline; onClose: () => void }) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const router = useRouter()
  const now = useNow()
  const setDone = useSetDeadlineDone()
  const remove = useDeleteDeadline()
  const shown = deadline
  const [problem, setProblem] = useState<string | null>(null)
  const busy = setDone.isPending || remove.isPending
  const overdue = !shown.done && Date.parse(shown.dueAt) < now.getTime()

  const failure = (error: unknown) =>
    error instanceof ApiError && error.status === 404
      ? t('deadlines.own.gone')
      : error instanceof ApiError
        ? t('api.serverError')
        : t('deadlines.own.unreachable')

  const toggleDone = () => {
    setProblem(null)
    setDone.mutate(
      { id: shown.id, done: !shown.done },
      { onError: (error) => setProblem(failure(error)) },
    )
  }

  const confirmDelete = () => {
    Alert.alert(
      t('deadlines.own.deleteTitle'),
      t('deadlines.own.deleteConfirm', { title: shown.title }),
      [
        { text: t('deadlines.own.cancel'), style: 'cancel', isPreferred: true },
        {
          text: t('deadlines.own.delete'),
          style: 'destructive',
          onPress: () =>
            remove.mutate(shown.id, {
              onSuccess: onClose,
              onError: (error) => setProblem(failure(error)),
            }),
        },
      ],
      { cancelable: true },
    )
  }

  const edit = () => {
    onClose()
    router.push({ pathname: '/deadline/[id]', params: { id: shown.id } })
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, shown.done && styles.doneTitle]}>
          {shown.title}
        </Text>
        <Text style={styles.subtitle}>
          {[shown.course, t('deadlines.own.tag')].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <SheetField
        value={format.dateTime(Date.parse(shown.dueAt))}
        label={t('deadlines.detail.due')}
      />
      {overdue ? (
        <View style={[styles.tag, styles.tagWarn]}>
          <Text style={[styles.tagText, styles.warnText]}>{t('deadlines.overdue')}</Text>
        </View>
      ) : null}
      {shown.notes ? <SheetField value={shown.notes} label={t('deadlines.own.notes')} /> : null}
      <SheetField
        value={shown.done ? t('deadlines.own.done') : t('deadlines.own.notDone')}
        label={t('deadlines.own.status')}
      />

      {problem ? (
        <Text accessibilityLiveRegion="polite" style={styles.problem}>
          {problem}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={shown.done ? t('deadlines.own.markNotDone') : t('deadlines.own.markDone')}
          busy={setDone.isPending}
          onPress={() => {
            if (!busy) toggleDone()
          }}
        />
        <Button
          label={t('deadlines.own.edit')}
          variant="secondary"
          onPress={() => {
            if (!busy) edit()
          }}
        />
        <Button
          label={t('deadlines.own.delete')}
          variant="secondary"
          busy={remove.isPending}
          onPress={() => {
            if (!busy) confirmDelete()
          }}
        />
        <Button label={t('deadlines.detail.close')} variant="secondary" onPress={onClose} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  header: { gap: space.xs },
  title: { ...type.heading, color: color.ink },
  doneTitle: { color: color.inkMuted, textDecorationLine: 'line-through' },
  subtitle: { ...type.bodySmall, color: color.inkMuted },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  tagWarn: { borderColor: color.warn },
  tagText: { ...type.caption },
  warnText: { color: color.warn },
  problem: { ...type.bodySmall, color: color.warn },
  actions: { gap: space.sm, marginTop: space.sm },
})
