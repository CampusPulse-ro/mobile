import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native'

import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'

import type { Occurrence } from './api'
import { classKey, classTiming, useClassText } from './classes'
import { campusInstant, campusNoon } from './dates'

/** How tall an hour is in the grid. */
const HOUR = 44

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Side-by-side lanes for classes that overlap on one day (two optional subjects at once). */
function layOut(classes: Occurrence[]) {
  const laneEnds: number[] = []
  const placed = classes.map((occurrence) => {
    const start = minutesOf(occurrence.startsAt)
    let lane = laneEnds.findIndex((end) => end <= start)
    if (lane === -1) lane = laneEnds.push(0) - 1
    laneEnds[lane] = minutesOf(occurrence.endsAt)
    return { occurrence, lane }
  })
  return { placed, lanes: Math.max(1, laneEnds.length) }
}

/**
 * Monday to Friday as a time grid: one column per day, each class a block sized by its duration,
 * today's column marked and the class going on now outlined in the accent colour.
 */
export function WeekGrid({
  days,
  classes,
  today,
  now,
  onSelect,
}: {
  days: string[]
  classes: Occurrence[]
  today: string
  now: Date
  onSelect: (occurrence: Occurrence) => void
}) {
  const format = useDateTimeFormat()
  const text = useClassText()
  const firstHour = Math.min(8, ...classes.map((c) => Math.floor(minutesOf(c.startsAt) / 60)))
  const lastHour = Math.max(20, ...classes.map((c) => Math.ceil(minutesOf(c.endsAt) / 60)))
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)
  const height = (lastHour - firstHour) * HOUR
  const anyDay = days[0] ?? today

  return (
    <View>
      <View style={styles.headRow}>
        <View style={styles.gutter} />
        {days.map((date) => {
          const noon = campusNoon(date)
          const isToday = date === today
          return (
            <View key={date} style={styles.dayHead}>
              <Text style={[styles.dayName, isToday && styles.accent]}>
                {format.weekdayShort(noon)}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.accent]}>{format.day(noon)}</Text>
            </View>
          )
        })}
      </View>

      <View style={[styles.body, { height: height + space.sm }]}>
        {hours.map((hour) => (
          <View key={hour} style={[styles.hourLine, { top: (hour - firstHour) * HOUR }]}>
            <Text style={styles.hourLabel}>{format.time(campusInstant(anyDay, `${hour}:00`))}</Text>
          </View>
        ))}
        <View style={styles.gutter} />
        {days.map((date) => {
          const { placed, lanes } = layOut(classes.filter((c) => c.date === date))
          return (
            <View key={date} style={[styles.column, date === today && styles.todayColumn]}>
              {placed.map(({ occurrence, lane }) => {
                const start = minutesOf(occurrence.startsAt) - firstHour * 60
                const end = minutesOf(occurrence.endsAt) - firstHour * 60
                const timing =
                  date === today ? classTiming(occurrence, now) : date < today ? 'past' : 'later'
                const left: DimensionValue = `${(lane / lanes) * 100}%`
                const width: DimensionValue = `${100 / lanes}%`
                return (
                  <Pressable
                    key={classKey(occurrence)}
                    accessibilityRole="button"
                    accessibilityLabel={[
                      format.weekday(campusNoon(date)),
                      format.timeRange(
                        campusInstant(date, occurrence.startsAt),
                        campusInstant(date, occurrence.endsAt),
                      ),
                      occurrence.subject,
                      text.kindAndRoom(occurrence),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    onPress={() => onSelect(occurrence)}
                    style={[
                      styles.block,
                      {
                        top: (start / 60) * HOUR,
                        height: ((end - start) / 60) * HOUR,
                        left,
                        width,
                      },
                      timing === 'now' && styles.blockNow,
                      timing === 'past' && styles.past,
                    ]}
                  >
                    <Text style={[styles.blockTitle, timing === 'now' && styles.accent]}>
                      {occurrence.shortName ?? occurrence.subject}
                    </Text>
                    <Text style={styles.blockText}>{text.kinds(occurrence.kinds)}</Text>
                    {occurrence.room ? (
                      <Text style={styles.blockText}>{occurrence.room}</Text>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const GUTTER = 40

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', paddingBottom: space.sm },
  gutter: { width: GUTTER },
  dayHead: { flex: 1, alignItems: 'center' },
  dayName: { ...type.caption, color: color.inkMuted },
  dayNumber: { ...type.label, color: color.ink },
  accent: { color: color.accent },
  body: { flexDirection: 'row' },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  hourLabel: { ...type.caption, color: color.inkMuted, width: GUTTER - space.xs, marginTop: -8 },
  column: { flex: 1, marginHorizontal: 1 },
  todayColumn: { backgroundColor: color.raised, borderRadius: radius.sm },
  block: {
    position: 'absolute',
    padding: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.raised,
    overflow: 'hidden',
  },
  blockNow: { borderColor: color.accent, borderWidth: 2 },
  past: { opacity: 0.5 },
  blockTitle: { ...type.caption, color: color.ink, fontWeight: '700' },
  blockText: { ...type.caption, color: color.inkMuted },
})
