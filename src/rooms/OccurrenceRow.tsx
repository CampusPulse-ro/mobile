import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { Pill } from '@/components/States'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import { campusInstant, useClassText } from '@/timetable'

import type { RoomOccurrence } from './api'

/**
 * One thing on in a room: the time on the left, then a card with the subject, its kinds and the
 * groups it's for (an offered slot has none: it's for whoever picked it). The one going on now is
 * outlined in the accent colour; finished ones are dimmed.
 */
export function OccurrenceRow({
  occurrence,
  date,
  timing,
}: {
  occurrence: RoomOccurrence
  date: string
  timing: 'past' | 'now' | 'later' | null
}) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const text = useClassText()
  const startsAt = campusInstant(date, occurrence.startsAt)
  const endsAt = campusInstant(date, occurrence.endsAt)
  const now = timing === 'now'
  const kinds = text.kinds(occurrence.kinds)
  const groups = occurrence.offered
    ? t('rooms.day.offeredAbout')
    : occurrence.groups.length > 0
      ? occurrence.groups.join(', ')
      : null

  const label = [
    format.timeRange(startsAt, endsAt),
    occurrence.subject,
    kinds,
    occurrence.offered ? t('rooms.day.offered') : null,
    groups,
    now ? t('timetable.now') : timing === 'past' ? t('timetable.finished') : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.row, timing === 'past' && styles.past]}
    >
      <View style={styles.time}>
        <Text style={[styles.start, now && styles.accent]}>{format.time(startsAt)}</Text>
        <Text style={styles.end}>{format.time(endsAt)}</Text>
      </View>
      <View style={[styles.card, now && styles.cardNow]}>
        <Text style={styles.subject}>{occurrence.subject}</Text>
        {kinds ? <Text style={styles.details}>{kinds}</Text> : null}
        {groups ? <Text style={styles.groups}>{groups}</Text> : null}
        {now || occurrence.offered ? (
          <View style={styles.pills}>
            {now ? <Pill label={t('timetable.now')} accent /> : null}
            {occurrence.offered ? <Pill label={t('rooms.day.offered')} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, minHeight: 44 },
  past: { opacity: 0.5 },
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
  groups: { ...type.bodySmall, color: color.inkMuted },
  pills: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
})
