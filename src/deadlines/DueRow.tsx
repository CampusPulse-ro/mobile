import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, radius, space, type } from '@/theme'

import type { DueItem } from './manual'
import { useDeadlineText } from './text'

/**
 * One deadline in a list (Today's "Due soon", the Deadlines screen): its name, when it's due, its
 * course, and tags: "Added by you" for the student's own, "Overdue", "Done".
 */
export function DueRow({
  item,
  today,
  now,
  onPress,
}: {
  item: DueItem
  today: string
  now: number
  onPress: () => void
}) {
  const { t } = useTranslation()
  const text = useDeadlineText()
  const due = text.due(item, today)
  const own = item.kind === 'manual'
  const name = own ? item.deadline.title : item.deadline.name
  const course = own ? (item.deadline.course ?? '') : (item.deadline.course?.shortName ?? '')
  const done = own && item.deadline.done
  const overdue = own ? !done && item.dueAt < now : item.deadline.overdue
  const label = [
    name,
    course,
    due,
    own ? t('deadlines.own.tag') : null,
    overdue ? t('deadlines.overdue') : null,
    done ? t('deadlines.own.doneTag') : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('deadlines.openDetail')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={[styles.name, done && styles.doneName]} numberOfLines={2}>
        {name}
      </Text>
      <View style={styles.meta}>
        <Text style={[styles.due, overdue && styles.warnText]}>{due}</Text>
        {course ? (
          <Text style={styles.course} numberOfLines={1}>
            {course}
          </Text>
        ) : null}
        {own ? <Tag label={t('deadlines.own.tag')} /> : null}
        {overdue ? <Tag label={t('deadlines.overdue')} warn /> : null}
        {done ? <Tag label={t('deadlines.own.doneTag')} success /> : null}
      </View>
    </Pressable>
  )
}

function Tag({ label, warn = false, success = false }: TagProps) {
  return (
    <View style={[styles.tag, warn && styles.tagWarn, success && styles.tagSuccess]}>
      <Text style={[styles.tagText, warn && styles.warnText, success && styles.successText]}>
        {label}
      </Text>
    </View>
  )
}

type TagProps = { label: string; warn?: boolean; success?: boolean }

const styles = StyleSheet.create({
  card: {
    gap: space.xs,
    minHeight: 44,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  pressed: { opacity: 0.8 },
  name: { ...type.label, color: color.ink },
  doneName: { color: color.inkMuted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  due: { ...type.caption, color: color.inkSoft },
  course: { ...type.caption, color: color.inkMuted, flexShrink: 1 },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  tagWarn: { borderColor: color.warn },
  tagSuccess: { borderColor: color.success },
  tagText: { ...type.caption, color: color.inkSoft },
  warnText: { color: color.warn },
  successText: { color: color.success },
})
