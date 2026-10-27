import type { UseQueryResult } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { CampusVirtualExpiredError, type Deadline } from '@/campusVirtual'
import { color, radius, space, type } from '@/theme'

import { useDeadlineText } from './text'

/**
 * Today's "Due soon" section: the next Campus Virtual deadlines. Small and non-blocking: when
 * Campus Virtual isn't connected it's one line pointing to Profile, and a Moodle failure never
 * takes the rest of Today down.
 */
export function DueSoon({
  deadlines,
  today,
  onOpen,
}: {
  deadlines: UseQueryResult<Deadline[] | null>
  today: string
  onOpen: (deadline: Deadline) => void
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data, error, isPending, isError } = deadlines

  let content
  if (isPending) {
    content = (
      <View style={styles.line}>
        <ActivityIndicator color={color.inkMuted} />
        <Text style={styles.muted}>{t('deadlines.loading')}</Text>
      </View>
    )
  } else if (error instanceof CampusVirtualExpiredError || data === null) {
    content = (
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.muted}>
          {error instanceof CampusVirtualExpiredError
            ? t('deadlines.expired')
            : t('deadlines.connect')}
        </Text>
      </Pressable>
    )
  } else if (isError && !data) {
    content = (
      <Pressable
        accessibilityRole="button"
        onPress={() => void deadlines.refetch()}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.problem}>{t('deadlines.failed')}</Text>
        <Text style={styles.retry}>{t('deadlines.retry')}</Text>
      </Pressable>
    )
  } else if (!data || data.length === 0) {
    content = <Text style={styles.muted}>{t('deadlines.empty')}</Text>
  } else {
    content = (
      <View style={styles.list}>
        {isError ? <Text style={styles.problem}>{t('states.refreshFailed')}</Text> : null}
        {data.map((deadline) => (
          <DeadlineRow
            key={deadline.id}
            deadline={deadline}
            today={today}
            onPress={() => onOpen(deadline)}
          />
        ))}
      </View>
    )
  }

  // Not connected: just the one line, no heading over it.
  const connected = !(data === null && !isPending)
  return (
    <View style={styles.section}>
      {connected ? (
        <Text accessibilityRole="header" style={styles.heading}>
          {t('deadlines.title')}
        </Text>
      ) : null}
      {content}
    </View>
  )
}

function DeadlineRow({
  deadline,
  today,
  onPress,
}: {
  deadline: Deadline
  today: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const text = useDeadlineText()
  const due = text.due(deadline, today)
  const course = deadline.course?.shortName ?? ''
  const label = [deadline.name, course, due, deadline.overdue ? t('deadlines.overdue') : null]
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
      <Text style={styles.name} numberOfLines={2}>
        {deadline.name}
      </Text>
      <View style={styles.meta}>
        <Text style={[styles.due, deadline.overdue && styles.overdueText]}>{due}</Text>
        {course ? (
          <Text style={styles.course} numberOfLines={1}>
            {course}
          </Text>
        ) : null}
        {deadline.overdue ? (
          <View style={styles.overdue}>
            <Text style={styles.overdueText}>{t('deadlines.overdue')}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { ...type.label, color: color.inkSoft },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    minHeight: 44,
  },
  muted: { ...type.bodySmall, color: color.inkMuted, flexShrink: 1 },
  problem: { ...type.bodySmall, color: color.warn, flexShrink: 1 },
  retry: { ...type.label, color: color.accent },
  pressed: { opacity: 0.8 },
  list: { gap: space.sm },
  card: {
    gap: space.xs,
    minHeight: 44,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  name: { ...type.label, color: color.ink },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  due: { ...type.caption, color: color.inkSoft },
  course: { ...type.caption, color: color.inkMuted, flexShrink: 1 },
  overdue: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.warn,
  },
  overdueText: { ...type.caption, color: color.warn },
})
