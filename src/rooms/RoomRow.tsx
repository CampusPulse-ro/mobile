import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Pill } from '@/components/States'
import { color, radius, space, type } from '@/theme'

import type { Room } from './api'
import { useRoomStatusText } from './RoomStatusText'
import type { RoomStatus } from './status'

/** "North · floor 2 · 120 seats": what the list and a room's day say under the code. */
export function useRoomDetails() {
  const { t } = useTranslation()
  return (room: Room) =>
    [
      room.building,
      room.floor ? t('rooms.floor', { floor: room.floor }) : null,
      room.capacity != null ? t('rooms.capacity', { n: room.capacity }) : null,
    ]
      .filter(Boolean)
      .join(' · ')
}

/**
 * One room in the list: its code, building, floor and capacity, and its status right now when
 * today's timetable for it is already known (`status` null: nothing shown).
 */
export function RoomRow({
  room,
  status,
  onPress,
}: {
  room: Room
  status: RoomStatus | null
  onPress: () => void
}) {
  const { t } = useTranslation()
  const details = useRoomDetails()(room)
  const describe = useRoomStatusText()
  const statusText = status ? describe(status) : null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[room.code, details, statusText?.short].filter(Boolean).join(', ')}
      accessibilityHint={t('rooms.openDay')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.code}>{room.code}</Text>
        {details ? <Text style={styles.details}>{details}</Text> : null}
      </View>
      {statusText ? (
        // Pill aligns itself to the top; the wrapper keeps it centred in the row.
        <View>
          <Pill label={statusText.short} accent={statusText.free} />
        </View>
      ) : null}
      <Text style={styles.chevron}>{'›'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  code: { ...type.subtitle, color: color.ink },
  details: { ...type.caption, color: color.inkMuted },
  chevron: { ...type.heading, color: color.inkMuted },
})
