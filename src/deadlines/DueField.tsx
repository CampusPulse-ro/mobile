import DateTimePicker from '@expo/ui/community/datetime-picker'
import { getCalendars } from 'expo-localization'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import { campusInstant } from '@/timetable/dates'

/**
 * A deadline's due date and time, as campus wall-clock values (`YYYY-MM-DD`, `HH:mm`), like every
 * time in the app. The pickers are `@expo/ui`'s (already in the app's native build): Material 3
 * dialogs on Android, opened from the two rows; inline pickers on iOS.
 *
 * The pickers work in the phone's own zone. They're given, and read back, the wall-clock values
 * only, so a phone set to another zone still picks campus times.
 */
export function DueField({
  date,
  time,
  onChange,
}: {
  date: string
  time: string
  onChange: (date: string, time: string) => void
}) {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  const [open, setOpen] = useState<'date' | 'time' | null>(null)
  const instant = campusInstant(date, time)
  const value = asPhoneTime(date, time)
  const is24Hour = getCalendars()[0]?.uses24hourClock ?? true
  const buttons = {
    positiveButton: { label: t('deadlines.form.ok') },
    negativeButton: { label: t('deadlines.form.cancel') },
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{t('deadlines.form.due')}</Text>
        <View style={styles.iosRow}>
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            themeVariant="dark"
            accentColor={color.accent}
            onValueChange={(_, picked) => onChange(dateOf(picked), time)}
          />
          <DateTimePicker
            value={value}
            mode="time"
            display="compact"
            themeVariant="dark"
            accentColor={color.accent}
            onValueChange={(_, picked) => onChange(date, timeOf(picked))}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t('deadlines.form.due')}</Text>
      <View style={styles.rows}>
        <FieldButton
          label={t('deadlines.form.date')}
          value={format.date(instant)}
          onPress={() => setOpen('date')}
        />
        <FieldButton
          label={t('deadlines.form.time')}
          value={format.time(instant)}
          onPress={() => setOpen('time')}
        />
      </View>
      {/* Each dialog opens when it's mounted, and is unmounted again when it answers. */}
      {open === 'date' ? (
        <DateTimePicker
          value={value}
          mode="date"
          presentation="dialog"
          accentColor={color.accent}
          {...buttons}
          onValueChange={(_, picked) => {
            setOpen(null)
            onChange(dateOf(picked), time)
          }}
          onDismiss={() => setOpen(null)}
        />
      ) : null}
      {open === 'time' ? (
        <DateTimePicker
          value={value}
          mode="time"
          presentation="dialog"
          is24Hour={is24Hour}
          accentColor={color.accent}
          {...buttons}
          onValueChange={(_, picked) => {
            setOpen(null)
            onChange(date, timeOf(picked))
          }}
          onDismiss={() => setOpen(null)}
        />
      ) : null}
    </View>
  )
}

function FieldButton({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={t('deadlines.form.changeHint')}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
      <Text style={styles.buttonValue}>{value}</Text>
    </Pressable>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A phone-local Date showing the campus wall-clock date and time, for the pickers. */
function asPhoneTime(date: string, time: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

function dateOf(picked: Date): string {
  return `${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`
}

function timeOf(picked: Date): string {
  return `${pad(picked.getHours())}:${pad(picked.getMinutes())}`
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { ...type.label, color: color.ink },
  rows: { flexDirection: 'row', gap: space.sm },
  iosRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  pressed: { opacity: 0.7 },
  buttonLabel: { ...type.caption, color: color.inkMuted },
  buttonValue: { ...type.body, color: color.ink },
})
