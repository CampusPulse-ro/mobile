import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'

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
  const insets = useSafeAreaInsets()
  // Keep the last class on screen while the sheet slides away.
  const [shown, setShown] = useState(occurrence)
  if (occurrence && occurrence !== shown) setShown(occurrence)

  return (
    <Modal
      visible={occurrence !== null}
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
          {shown ? <Details occurrence={shown} onClose={onClose} /> : null}
        </View>
      </View>
    </Modal>
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

      <Field
        value={format.timeRange(startsAt, endsAt)}
        label={t('timetable.detail.when', {
          date: `${format.weekday(day)} ${format.dayMonth(day)}`,
          week: occurrence.week,
        })}
      />
      {occurrence.room ? (
        <Field value={occurrence.room} label={t('timetable.detail.room')} />
      ) : null}
      {occurrence.teacher ? (
        <Field value={occurrence.teacher} label={t('timetable.detail.teacher')} />
      ) : null}
      {occurrence.note ? (
        <Field value={occurrence.note} label={t('timetable.detail.note')} />
      ) : null}
      {occurrence.optional ? (
        <Field value={t('timetable.detail.optional')} label={t('timetable.detail.optionalAbout')} />
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
  actions: { gap: space.sm, marginTop: space.sm },
})
