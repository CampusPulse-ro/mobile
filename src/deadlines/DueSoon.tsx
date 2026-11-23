import type { UseQueryResult } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { CampusVirtualExpiredError, type Deadline } from '@/campusVirtual'
import { color, space, type } from '@/theme'
import { addDays, campusInstant } from '@/timetable/dates'

import { DueRow } from './DueRow'
import { dueList, type DueItem, type ManualDeadline } from './manual'

/**
 * Today's "Due soon" section: Campus Virtual's deadlines and the student's own ones for the next
 * 14 days (own ones that are overdue stay until marked done). Small and non-blocking: a failure of
 * either source is one line, never in the way of the rest of Today.
 */
export function DueSoon({
  campusVirtual,
  manual,
  uptLinked,
  today,
  now,
  onOpen,
}: {
  campusVirtual: UseQueryResult<Deadline[] | null>
  manual: UseQueryResult<ManualDeadline[]>
  uptLinked: boolean | undefined
  today: string
  now: number
  onOpen: (item: DueItem) => void
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const until = campusInstant(addDays(today, 14), '00:00').getTime()
  const items = dueList(campusVirtual.data, manual.data, until)

  let content
  if (campusVirtual.isPending && manual.isPending) {
    content = (
      <View style={styles.line}>
        <ActivityIndicator color={color.inkMuted} />
        <Text style={styles.muted}>{t('deadlines.loading')}</Text>
      </View>
    )
  } else if (items.length === 0) {
    // Said only once both sources have answered, or a late one could contradict it.
    const settled = manual.isSuccess && !campusVirtual.isPending
    content = settled ? <Text style={styles.muted}>{t('deadlines.empty')}</Text> : null
  } else {
    content = (
      <View style={styles.list}>
        {items.map((item) => (
          <DueRow key={item.key} item={item} today={today} now={now} onPress={() => onOpen(item)} />
        ))}
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('deadlines.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/deadlines')}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkText}>{t('deadlines.all')}</Text>
        </Pressable>
      </View>
      {content}
      <ManualProblem manual={manual} />
      <CampusVirtualLine campusVirtual={campusVirtual} uptLinked={uptLinked} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/deadline/new')}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>{`+ ${t('deadlines.own.add')}`}</Text>
      </Pressable>
    </View>
  )
}

/** The student's own deadlines couldn't be loaded (or refreshed): one line, with a retry. */
export function ManualProblem({ manual }: { manual: UseQueryResult<ManualDeadline[]> }) {
  const { t } = useTranslation()
  if (!manual.isError) return null
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void manual.refetch()}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <Text style={styles.problem}>
        {manual.data ? t('deadlines.own.refreshFailed') : t('deadlines.own.failed')}
      </Text>
      <Text style={styles.retry}>{t('deadlines.retry')}</Text>
    </Pressable>
  )
}

/**
 * Campus Virtual's state when it adds nothing to the list: not connected (pointing to Profile;
 * left out while UPT isn't linked, where the "Link UPT" banner says it), expired, or failing.
 */
export function CampusVirtualLine({
  campusVirtual,
  uptLinked,
}: {
  campusVirtual: UseQueryResult<Deadline[] | null>
  uptLinked: boolean | undefined
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data, error, isError } = campusVirtual

  const expired = error instanceof CampusVirtualExpiredError
  if (expired || (data === null && uptLinked)) {
    return (
      <Pressable
        accessibilityRole="link"
        onPress={() => router.navigate('/profile')}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.muted}>
          {expired ? t('deadlines.expired') : t('deadlines.connect')}
        </Text>
      </Pressable>
    )
  }
  if (isError) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void campusVirtual.refetch()}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.problem}>
          {data ? t('deadlines.refreshFailed') : t('deadlines.failed')}
        </Text>
        <Text style={styles.retry}>{t('deadlines.retry')}</Text>
      </Pressable>
    )
  }
  return null
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  heading: { ...type.label, color: color.inkSoft },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...type.label, color: color.accent },
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
})
