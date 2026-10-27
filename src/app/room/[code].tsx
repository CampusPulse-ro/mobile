import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/client'
import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/States'
import { Screen } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import {
  occurrenceKey,
  occurrenceTiming,
  OccurrenceRow,
  roomStatus,
  sortOccurrences,
  useRoomDetails,
  useRooms,
  useRoomStatusText,
  useRoomTimetable,
} from '@/rooms'
import { color, radius, space, type } from '@/theme'
import { addDays, campusNoon, campusToday, useNow } from '@/timetable'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * One room's day: whether it's free right now, then everything on in it that day in time order.
 * Opens on today (or the `date` param); the arrows move a day at a time.
 */
export default function RoomDayScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const format = useDateTimeFormat()
  const describe = useRoomStatusText()
  const roomDetails = useRoomDetails()
  const params = useLocalSearchParams<{ code: string; date?: string }>()
  const code = typeof params.code === 'string' ? params.code : ''
  const now = useNow()
  const today = campusToday(now)
  const [chosenDate, setChosenDate] = useState<string | null>(
    params.date && DATE.test(params.date) ? params.date : null,
  )
  const date = chosenDate ?? today
  const isToday = date === today
  const rooms = useRooms()
  const timetable = useRoomTimetable(code, date)
  const [refreshing, setRefreshing] = useState(false)

  const room = timetable.data?.room ?? rooms.data?.find((r) => r.code === code) ?? null
  const details = room ? roomDetails(room) : ''
  const occurrences = sortOccurrences(timetable.data?.occurrences ?? [])
  const status = isToday && timetable.data ? describe(roomStatus(occurrences, date, now)) : null
  const week = timetable.data?.week ?? null
  const day = campusNoon(date)

  const refresh = async () => {
    setRefreshing(true)
    await timetable.refetch()
    setRefreshing(false)
  }

  let body
  if (timetable.isPending) {
    body = <LoadingState />
  } else if (timetable.error instanceof ApiError && timetable.error.status === 404) {
    body = <EmptyState title={t('rooms.day.notFound')} />
  } else if (timetable.isError && !timetable.data) {
    body = <ErrorState error={timetable.error} onRetry={() => void timetable.refetch()} />
  } else if (occurrences.length === 0) {
    body = <EmptyState title={isToday ? t('rooms.day.empty') : t('rooms.day.emptyOn')} />
  } else {
    body = (
      <View style={styles.list}>
        {timetable.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        {occurrences.map((occurrence, index) => (
          <OccurrenceRow
            key={occurrenceKey(occurrence, index)}
            occurrence={occurrence}
            date={date}
            timing={isToday ? occurrenceTiming(occurrence, date, now) : null}
          />
        ))}
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
        <View style={styles.titleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('rooms.day.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/map'))}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <View style={styles.titleText}>
            <Text accessibilityRole="header" style={styles.title}>
              {code}
            </Text>
            {details ? <Text style={styles.details}>{details}</Text> : null}
          </View>
        </View>

        <View style={styles.dayRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('rooms.day.previousDay')}
            onPress={() => setChosenDate(addDays(date, -1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>{'‹'}</Text>
          </Pressable>
          <View style={styles.dayText} accessible>
            <Text style={styles.weekday}>{format.weekday(day)}</Text>
            <Text style={styles.date}>
              {[format.dayMonth(day), week ? t('timetable.week', { week }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('rooms.day.nextDay')}
            onPress={() => setChosenDate(addDays(date, 1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>{'›'}</Text>
          </Pressable>
        </View>

        {isToday ? (
          <Pill label={t('timetable.today')} accent />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setChosenDate(null)}
            style={({ pressed }) => [styles.todayLink, pressed && styles.pressed]}
          >
            <Text style={styles.todayLinkText}>{t('rooms.day.backToToday')}</Text>
          </Pressable>
        )}

        {status ? (
          <View
            accessible
            accessibilityLabel={`${status.title}. ${status.detail}`}
            style={[styles.status, status.free ? styles.statusFree : styles.statusInUse]}
          >
            <Text style={[styles.statusTitle, status.free ? styles.free : styles.inUse]}>
              {status.title}
            </Text>
            <Text style={styles.statusDetail}>{status.detail}</Text>
          </View>
        ) : null}

        {body}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -space.sm },
  backText: { ...type.title, color: color.ink, paddingLeft: space.sm },
  pressed: { opacity: 0.6 },
  titleText: { flex: 1 },
  title: { ...type.title, color: color.ink },
  details: { ...type.bodySmall, color: color.inkSoft },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { ...type.heading, color: color.ink },
  dayText: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  weekday: { ...type.label, color: color.ink },
  date: { ...type.caption, color: color.inkMuted },
  todayLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  todayLinkText: { ...type.label, color: color.accent },
  status: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: color.raised,
  },
  statusFree: { borderColor: color.success },
  statusInUse: { borderColor: color.warn },
  statusTitle: { ...type.heading },
  free: { color: color.success },
  inUse: { color: color.warn },
  statusDetail: { ...type.bodySmall, color: color.inkSoft },
  list: { gap: space.md },
  stale: { ...type.caption, color: color.warn },
})
