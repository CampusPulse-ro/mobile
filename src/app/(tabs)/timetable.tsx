import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/States'
import { Button, Screen, Title } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import {
  addDays,
  campusNoon,
  campusToday,
  ClassRow,
  ClassSheet,
  classKey,
  classTiming,
  dayOff,
  defaultWeekStart,
  sortClasses,
  useClassText,
  useMyTimetable,
  useNow,
  useSemester,
  useSettings,
  WeekGrid,
  type Occurrence,
} from '@/timetable'

/** The two ways to see a week: an agenda day by day, or a time grid. */
const LAYOUTS = ['list', 'week'] as const
type Layout = (typeof LAYOUTS)[number]

/**
 * Monday to Friday of one week, as an agenda (day by day) or a time grid; arrows move a week
 * back or forward.
 */
export default function TimetableScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const format = useDateTimeFormat()
  const text = useClassText()
  const now = useNow()
  const today = campusToday(now)
  const thisWeek = defaultWeekStart(today)
  const [chosenWeek, setChosenWeek] = useState<string | null>(null)
  const monday = chosenWeek ?? thisWeek
  const friday = addDays(monday, 4)
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset))

  const settings = useSettings()
  const semester = useSemester()
  const hasGroup = Boolean(settings.data?.studyGroup)
  const timetable = useMyTimetable(monday, friday, { enabled: hasGroup })
  const classes = sortClasses(timetable.data?.occurrences ?? [])
  const [selected, setSelected] = useState<Occurrence | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [layout, setLayout] = useState<Layout>('list')

  const week =
    semester.data?.weeks.find((w) => w.startsOn === monday)?.number ?? classes[0]?.week ?? null
  const sameMonth = monday.slice(0, 7) === friday.slice(0, 7)
  const range = sameMonth
    ? `${format.day(campusNoon(monday))}–${format.dayMonth(campusNoon(friday))}`
    : `${format.dayMonth(campusNoon(monday))} – ${format.dayMonth(campusNoon(friday))}`
  const weekLabel = week ? `${t('timetable.weekTitle', { week })} · ${range}` : range

  const goToWeek = (start: string) => setChosenWeek(start === thisWeek ? null : start)

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([settings.refetch(), semester.refetch(), hasGroup && timetable.refetch()])
    setRefreshing(false)
  }

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
  } else if (layout === 'week') {
    body = (
      <>
        {timetable.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        <WeekGrid days={days} classes={classes} today={today} now={now} onSelect={setSelected} />
      </>
    )
  } else {
    body = (
      <View style={styles.days}>
        {timetable.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        {days.map((date) => {
          const dayClasses = classes.filter((occurrence) => occurrence.date === date)
          const off = dayOff(semester.data, date)
          const isToday = date === today
          const noon = campusNoon(date)
          const count =
            dayClasses.length === 0
              ? null
              : dayClasses.length === 1
                ? t('today.oneClass')
                : t('today.classes', { count: dayClasses.length })
          const emptyLine =
            off?.kind === 'holiday'
              ? t('today.holidayAbout', { reason: text.calendarName(off.reason) })
              : off?.kind === 'break'
                ? off.name
                  ? text.calendarName(off.name)
                  : t('today.break')
                : t('timetable.noClasses')
          return (
            <View key={date} style={styles.day}>
              <View style={styles.dayHeader} accessibilityRole="header">
                {isToday ? <Pill label={t('timetable.today')} accent /> : null}
                <Text style={[styles.weekday, isToday && styles.todayText]}>
                  {format.weekday(noon)}
                </Text>
                <Text style={styles.date}>{format.dayMonth(noon)}</Text>
                {count ? <Text style={styles.count}>{count}</Text> : null}
              </View>
              {dayClasses.length === 0 ? (
                <Text style={styles.empty}>{emptyLine}</Text>
              ) : (
                dayClasses.map((occurrence) => (
                  <ClassRow
                    key={classKey(occurrence)}
                    occurrence={occurrence}
                    timing={
                      isToday ? classTiming(occurrence, now) : date < today ? 'past' : 'later'
                    }
                    onPress={() => setSelected(occurrence)}
                  />
                ))
              )}
            </View>
          )
        })}
      </View>
    )
  }

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
        <Title>{t('timetable.title')}</Title>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('timetable.layout')}
          style={styles.segments}
        >
          {LAYOUTS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: layout === option }}
              onPress={() => setLayout(option)}
              style={[styles.segment, layout === option && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, layout === option && styles.segmentLabelSelected]}>
                {t(`timetable.layouts.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.weekNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('timetable.previousWeek')}
            onPress={() => goToWeek(addDays(monday, -7))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.weekLabel} accessibilityRole="header">
            {weekLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('timetable.nextWeek')}
            onPress={() => goToWeek(addDays(monday, 7))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>{'›'}</Text>
          </Pressable>
        </View>
        {chosenWeek ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setChosenWeek(null)}
            style={styles.backToThisWeek}
          >
            <Text style={styles.link}>{t('timetable.thisWeek')}</Text>
          </Pressable>
        ) : null}

        {body}
      </ScrollView>
      <ClassSheet occurrence={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  segments: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  segment: {
    minHeight: 40,
    minWidth: 72,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentSelected: { backgroundColor: color.sunken, borderWidth: 1, borderColor: color.lineStrong },
  segmentLabel: { ...type.label, color: color.inkMuted },
  segmentLabelSelected: { color: color.ink },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { ...type.heading, color: color.inkSoft },
  pressed: { opacity: 0.6 },
  weekLabel: { ...type.label, color: color.ink, flex: 1, textAlign: 'center' },
  backToThisWeek: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  link: { ...type.label, color: color.accent },
  days: { gap: space.xl },
  day: { gap: space.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  weekday: { ...type.label, color: color.ink },
  todayText: { color: color.accent },
  date: { ...type.bodySmall, color: color.inkSoft },
  count: { ...type.caption, color: color.inkMuted, marginLeft: 'auto' },
  empty: { ...type.bodySmall, color: color.inkMuted },
  stale: { ...type.caption, color: color.warn },
})
