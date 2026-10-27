import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Deadline } from '@/campusVirtual'
import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/States'
import { Button, Screen, Title } from '@/components/ui'
import { DeadlineSheet, DueSoon, useDeadlines } from '@/deadlines'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import {
  addDays,
  campusInstant,
  campusNoon,
  campusToday,
  ClassRow,
  ClassSheet,
  classKey,
  classTiming,
  dayOff,
  isWeekend,
  sortClasses,
  useClassText,
  useMyTimetable,
  useNow,
  useSemester,
  useSettings,
  type Occurrence,
} from '@/timetable'

/**
 * Today's classes in time order, the one going on now highlighted, or why there are none; below
 * them the Campus Virtual deadlines due soon.
 */
export default function TodayScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const format = useDateTimeFormat()
  const text = useClassText()
  const now = useNow()
  const today = campusToday(now)
  const settings = useSettings()
  const semester = useSemester()
  const hasGroup = Boolean(settings.data?.studyGroup)
  const timetable = useMyTimetable(today, today, { enabled: hasGroup })
  const classes = sortClasses(timetable.data?.occurrences ?? [])
  const noClasses = timetable.isSuccess && classes.length === 0
  // Only asked for on a day without classes, to say when the next one is.
  const upcoming = useMyTimetable(addDays(today, 1), addDays(today, 14), {
    enabled: hasGroup && noClasses,
  })
  // Campus Virtual, straight from Moodle: its own states, never in the way of the classes.
  const deadlines = useDeadlines()
  const [selected, setSelected] = useState<Occurrence | null>(null)
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const day = campusNoon(today)
  const off = dayOff(semester.data, today)
  const week = semester.data?.todayWeek ?? classes[0]?.week ?? null
  const settingsProblem = settings.data?.fromAnotherSemester
    ? t('today.groupFromAnotherSemester')
    : settings.data?.noLongerOffered
      ? t('today.groupNoLongerOffered')
      : null

  const summary = !hasGroup
    ? null
    : classes.length > 0
      ? [
          classes.length === 1
            ? t('today.oneClass')
            : t('today.classes', { count: classes.length }),
          week ? t('timetable.week', { week }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : off?.kind === 'holiday'
        ? t('today.nonTeachingDay')
        : off?.kind === 'break'
          ? t('today.break')
          : noClasses
            ? t('today.noClassesShort')
            : null

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([
      settings.refetch(),
      semester.refetch(),
      hasGroup && timetable.refetch(),
      deadlines.refetch(),
    ])
    setRefreshing(false)
  }

  const nextClass = sortClasses(upcoming.data?.occurrences ?? [])[0]
  const nextLine = nextClass
    ? t('today.next', {
        day: format.date(campusNoon(nextClass.date)),
        time: format.time(campusInstant(nextClass.date, nextClass.startsAt)),
        subject: nextClass.subject,
      })
    : null

  let body
  if (settings.isPending) {
    body = <LoadingState />
  } else if (settings.isError && !settings.data) {
    body = <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  } else if (!hasGroup) {
    body = (
      <EmptyState title={t('today.noGroup')} about={t('today.noGroupAbout')}>
        <Button label={t('today.chooseGroup')} onPress={() => router.push('/setup')} />
      </EmptyState>
    )
  } else if (timetable.isPending) {
    body = <LoadingState />
  } else if (timetable.isError && !timetable.data) {
    body = <ErrorState error={timetable.error} onRetry={() => void timetable.refetch()} />
  } else if (classes.length === 0) {
    const about =
      off?.kind === 'holiday'
        ? t('today.holidayAbout', { reason: text.calendarName(off.reason) })
        : off?.kind === 'break'
          ? off.resumesOn
            ? t('today.breakAbout', { date: format.date(campusNoon(off.resumesOn)) })
            : null
          : isWeekend(today)
            ? t('today.weekend')
            : null
    body = (
      <EmptyState
        title={
          off?.kind === 'break' && off.name ? text.calendarName(off.name) : t('today.noClasses')
        }
        about={[about, nextLine].filter(Boolean).join(' ')}
      />
    )
  } else {
    body = (
      <View style={styles.list}>
        {timetable.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        {classes.map((occurrence) => (
          <ClassRow
            key={classKey(occurrence)}
            occurrence={occurrence}
            timing={classTiming(occurrence, now)}
            onPress={() => setSelected(occurrence)}
          />
        ))}
      </View>
    )
  }

  const notes = hasGroup ? (timetable.data?.notes ?? []) : []

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={color.inkMuted}
            colors={[color.accent]}
            progressBackgroundColor={color.raised}
          />
        }
      >
        <Title>{t('today.title')}</Title>
        <View style={styles.dateRow}>
          <Pill label={t('timetable.today')} accent />
          <Text style={styles.weekday}>{format.weekday(day)}</Text>
          <Text style={styles.date}>{format.dayMonth(day)}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>

        {settingsProblem ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>{settingsProblem}</Text>
            <Button label={t('today.pickGroupAgain')} onPress={() => router.push('/setup')} />
          </View>
        ) : null}

        {body}

        <DueSoon deadlines={deadlines} today={today} onOpen={setSelectedDeadline} />

        {notes.length > 0 ? (
          <View style={styles.notes}>
            <Text style={styles.notesHeading}>{t('today.notes')}</Text>
            {notes.map((note, index) => (
              <Text key={`${index}-${note.text}`} style={styles.note}>
                {note.text}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <ClassSheet occurrence={selected} onClose={() => setSelected(null)} />
      <DeadlineSheet deadline={selectedDeadline} onClose={() => setSelectedDeadline(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  weekday: { ...type.label, color: color.ink },
  date: { ...type.bodySmall, color: color.inkSoft },
  summary: { ...type.caption, color: color.inkMuted, marginLeft: 'auto' },
  list: { gap: space.md },
  stale: { ...type.caption, color: color.warn },
  warning: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.warn,
    backgroundColor: color.raised,
  },
  warningText: { ...type.bodySmall, color: color.ink },
  notes: { gap: space.sm },
  notesHeading: { ...type.label, color: color.inkSoft },
  note: { ...type.bodySmall, color: color.inkMuted },
})
