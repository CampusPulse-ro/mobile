import { useTranslation } from 'react-i18next'

import { useDateTimeFormat } from '@/i18n/format'

import type { RoomStatus } from './status'

/**
 * A room status in words, in the UI language:
 * - `short`: the list's pill ("In use until 12:00", "Free until 14:00", "Free now");
 * - `title` and `detail`: the top of a room's day ("Free now" / "Next: 14:00 Algorithms").
 */
export function useRoomStatusText() {
  const { t } = useTranslation()
  const format = useDateTimeFormat()
  return (status: RoomStatus) => {
    if (status.kind === 'inUse') {
      const until = t('rooms.inUseUntil', { time: format.time(status.until) })
      return {
        free: false,
        short: until,
        title: until,
        detail: t('rooms.nowOn', { subject: status.current.subject }),
      }
    }
    const next = status.next
    return {
      free: true,
      short: next ? t('rooms.freeUntil', { time: format.time(next.at) }) : t('rooms.freeNow'),
      title: t('rooms.freeNow'),
      detail: next
        ? t('rooms.next', { time: format.time(next.at), subject: next.occurrence.subject })
        : t('rooms.nothingElseToday'),
    }
  }
}
