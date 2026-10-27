import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  BackHeader,
  groupByCourse,
  splitByDue,
  useAssignments,
  useAssignmentText,
  useKnownSubmission,
} from '@/assignments'
import { CampusVirtualExpiredError, type AssignmentRules } from '@/campusVirtual'
import { EmptyState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import { color, space, type } from '@/theme'
import { ChoiceList, ChoiceRow } from '@/timetable/Choice'
import { useNow } from '@/timetable'

/**
 * Every Campus Virtual assignment, by course: upcoming ones first (soonest due first), past ones
 * folded away below. Tapping one opens it, where it can be viewed and submitted.
 */
export default function AssignmentsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const assignments = useAssignments()
  const now = useNow().getTime()
  const [showPast, setShowPast] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await assignments.refetch()
    setRefreshing(false)
  }

  const expired = assignments.error instanceof CampusVirtualExpiredError
  let body
  if (assignments.isPending) {
    body = <LoadingState />
  } else if (expired || assignments.data === null) {
    body = (
      <EmptyState
        title={expired ? t('assignments.expired') : t('assignments.notConnected')}
        about={expired ? t('assignments.expiredAbout') : t('assignments.notConnectedAbout')}
      >
        <Button label={t('assignments.goToProfile')} onPress={() => router.navigate('/profile')} />
      </EmptyState>
    )
  } else if (assignments.isError && !assignments.data) {
    body = (
      <EmptyState title={t('assignments.loadFailed')} about={t('assignments.loadFailedAbout')}>
        <Button label={t('assignments.retry')} onPress={() => void assignments.refetch()} />
      </EmptyState>
    )
  } else if (assignments.data.length === 0) {
    body = <EmptyState title={t('assignments.empty')} about={t('assignments.emptyAbout')} />
  } else {
    const { upcoming, past } = splitByDue(assignments.data, now)
    body = (
      <View style={styles.list}>
        {assignments.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        {upcoming.length === 0 ? (
          <Text style={styles.muted}>{t('assignments.noUpcoming')}</Text>
        ) : (
          <Groups list={upcoming} now={now} />
        )}
        {past.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showPast }}
            onPress={() => setShowPast(!showPast)}
            style={({ pressed }) => [styles.pastToggle, pressed && styles.pressed]}
          >
            <Text style={styles.pastLabel}>{t('assignments.past', { n: past.length })}</Text>
            <Text style={styles.pastAction}>
              {showPast ? t('assignments.hidePast') : t('assignments.showPast')}
            </Text>
          </Pressable>
        ) : null}
        {past.length > 0 && showPast ? <Groups list={past} now={now} /> : null}
      </View>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={color.inkMuted}
            colors={[color.accent]}
            progressBackgroundColor={color.raised}
          />
        }
      >
        <BackHeader
          title={t('assignments.title')}
          subtitle={t('assignments.about')}
          large
          fallback="/profile"
        />
        {body}
      </ScrollView>
    </Screen>
  )
}

/** The assignments of each course under the course's name, in the order given. */
function Groups({ list, now }: { list: AssignmentRules[]; now: number }) {
  const text = useAssignmentText()
  return (
    <>
      {groupByCourse(list).map((group) => (
        <View key={group.courseId} style={styles.group}>
          <Text accessibilityRole="header" style={styles.course}>
            {text.course(group.assignments[0])}
          </Text>
          <ChoiceList>
            {group.assignments.map((rules, index) => (
              <AssignmentRow
                key={rules.id}
                rules={rules}
                now={now}
                last={index === group.assignments.length - 1}
              />
            ))}
          </ChoiceList>
        </View>
      ))}
    </>
  )
}

/**
 * One assignment: its name, when it's due (or when it opens, or that it's closed) and, when it
 * was opened before, its status as last loaded. No request per row.
 */
function AssignmentRow({
  rules,
  now,
  last,
}: {
  rules: AssignmentRules
  now: number
  last: boolean
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const text = useAssignmentText()
  const known = useKnownSubmission(rules.id)

  const status = known
    ? known.graded
      ? t('assignments.status.graded')
      : known.status === 'none' || known.status === 'new'
        ? null
        : text.status(known)
    : null
  const subtitle = [
    rules.dueAt !== null
      ? t('assignments.row.due', { when: text.whenShort(rules.dueAt, now) })
      : t('assignments.row.noDueDate'),
    rules.opensAt !== null && rules.opensAt > now
      ? t('assignments.row.opens', { when: text.whenShort(rules.opensAt, now) })
      : null,
    rules.cutoffAt !== null && rules.cutoffAt < now ? t('assignments.row.closed') : null,
    status,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ChoiceRow
      role="button"
      title={rules.name}
      subtitle={subtitle}
      last={last}
      onPress={() =>
        router.push({
          pathname: '/assignment/[id]',
          params: { id: String(rules.id), cmid: String(rules.cmid) },
        })
      }
    />
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  list: { gap: space.lg },
  group: { gap: space.sm },
  course: { ...type.label, color: color.inkSoft },
  muted: { ...type.bodySmall, color: color.inkMuted },
  stale: { ...type.caption, color: color.warn },
  pastToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  pastLabel: { ...type.label, color: color.inkSoft, flex: 1 },
  pastAction: { ...type.label, color: color.accent },
  pressed: { opacity: 0.6 },
})
