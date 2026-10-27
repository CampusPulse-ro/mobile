import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Pill } from '@/components/States'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'

import type { Occurrence } from './api'
import { useClassText, type ClassTiming } from './classes'
import { campusInstant } from './dates'

/**
 * One class in a day's list: the time on the left, then a card with the subject, kind, room and
 * teacher. The class going on now is outlined in the accent colour; finished ones are dimmed.
 */
export function ClassRow({
  occurrence,
  timing,
  onPress,
}: {
  occurrence: Occurrence
  timing: ClassTiming
  onPress: () => void
}) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const text = useClassText()
  const startsAt = campusInstant(occurrence.date, occurrence.startsAt)
  const endsAt = campusInstant(occurrence.date, occurrence.endsAt)
  const now = timing === 'now'
  const details = text.kindAndRoom(occurrence)

  const label = [
    format.timeRange(startsAt, endsAt),
    occurrence.subject,
    details,
    occurrence.teacher,
    now ? t('timetable.now') : timing === 'past' ? t('timetable.finished') : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('timetable.openDetail')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        timing === 'past' && styles.past,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.time}>
        <Text style={[styles.start, now && styles.accent]}>{format.time(startsAt)}</Text>
        <Text style={styles.end}>{format.time(endsAt)}</Text>
      </View>
      <View style={[styles.card, now && styles.cardNow]}>
        <Text style={styles.subject}>{occurrence.subject}</Text>
        {details ? <Text style={styles.details}>{details}</Text> : null}
        {occurrence.teacher ? <Text style={styles.teacher}>{occurrence.teacher}</Text> : null}
        {occurrence.note ? <Text style={styles.teacher}>{occurrence.note}</Text> : null}
        {now ? <Pill label={t('timetable.now')} accent /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, minHeight: 44 },
  past: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  time: { width: 52, paddingTop: space.md },
  start: { ...type.label, color: color.ink },
  end: { ...type.caption, color: color.inkMuted },
  accent: { color: color.accent },
  card: {
    flex: 1,
    gap: 2,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  cardNow: { borderColor: color.accent, borderWidth: 2 },
  subject: { ...type.subtitle, color: color.ink },
  details: { ...type.bodySmall, color: color.inkSoft },
  teacher: { ...type.bodySmall, color: color.inkMuted },
})
