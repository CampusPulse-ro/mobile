import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'

import { BottomSheet, SheetField } from '@/components/BottomSheet'
import { Button } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, space, type } from '@/theme'

import type { Occurrence } from './api'
import { useClassText } from './classes'
import { campusInstant, campusNoon } from './dates'

/**
 * A class's details in a bottom sheet: time and date, room, teacher, notes, and its Campus Virtual
 * course when it has one. Open while `occurrence` is set; `onClose` clears it.
 */
export function ClassSheet({
  occurrence,
  onClose,
}: {
  occurrence: Occurrence | null
  onClose: () => void
}) {
  return (
    <BottomSheet item={occurrence} onClose={onClose}>
      {(shown) => <Details occurrence={shown} onClose={onClose} />}
    </BottomSheet>
  )
}

function Details({ occurrence, onClose }: { occurrence: Occurrence; onClose: () => void }) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const text = useClassText()
  const startsAt = campusInstant(occurrence.date, occurrence.startsAt)
  const endsAt = campusInstant(occurrence.date, occurrence.endsAt)
  const day = campusNoon(occurrence.date)
  const url = occurrence.campusVirtualUrl

  const open = (link: string) => {
    void WebBrowser.openBrowserAsync(link).catch(() => Linking.openURL(link))
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {occurrence.subject}
        </Text>
        <Text style={styles.subtitle}>
          {[text.kinds(occurrence.kinds), format.weekday(day)].join(' · ')}
        </Text>
      </View>

      <SheetField
        value={format.timeRange(startsAt, endsAt)}
        label={t('timetable.detail.when', {
          date: `${format.weekday(day)} ${format.dayMonth(day)}`,
          week: occurrence.week,
        })}
      />
      {occurrence.room ? (
        <SheetField value={occurrence.room} label={t('timetable.detail.room')} />
      ) : null}
      {occurrence.teacher ? (
        <SheetField value={occurrence.teacher} label={t('timetable.detail.teacher')} />
      ) : null}
      {occurrence.note ? (
        <SheetField value={occurrence.note} label={t('timetable.detail.note')} />
      ) : null}
      {occurrence.optional ? (
        <SheetField
          value={t('timetable.detail.optional')}
          label={t('timetable.detail.optionalAbout')}
        />
      ) : null}

      <View style={styles.actions}>
        {url ? (
          <Button label={t('timetable.detail.openCampusVirtual')} onPress={() => open(url)} />
        ) : null}
        <Button label={t('timetable.detail.close')} variant="secondary" onPress={onClose} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  header: { gap: space.xs },
  title: { ...type.heading, color: color.ink },
  subtitle: { ...type.bodySmall, color: color.inkMuted },
  actions: { gap: space.sm, marginTop: space.sm },
})
