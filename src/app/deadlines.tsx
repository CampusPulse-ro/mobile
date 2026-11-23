import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import { BackHeader } from '@/assignments/parts'
import { useMe } from '@/auth'
import { UptNudge } from '@/auth/UptNudge'
import type { Deadline } from '@/campusVirtual'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import {
  CampusVirtualLine,
  DeadlineSheet,
  doneList,
  dueList,
  DueRow,
  ManualDeadlineSheet,
  ManualProblem,
  useDeadlines,
  useManualDeadlines,
  type DueItem,
  type ManualDeadline,
} from '@/deadlines'
import { color, space, type } from '@/theme'
import { campusToday, useNow } from '@/timetable'

/**
 * Every deadline: the student's own (all of them, overdue ones until marked done) and Campus
 * Virtual's for the next 14 days, soonest first; the done ones folded away below. "Add deadline"
 * on top, and while UPT isn't linked, the banner that suggests it.
 */
export default function DeadlinesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const now = useNow()
  const today = campusToday(now)
  const me = useMe()
  const campusVirtual = useDeadlines()
  const manual = useManualDeadlines()
  const [showDone, setShowDone] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [openCampusVirtual, setOpenCampusVirtual] = useState<Deadline | null>(null)
  const [openManualId, setOpenManualId] = useState<string | null>(null)
  // The sheet shows the cached copy, so marking it done here shows on the list at once.
  const openManual: ManualDeadline | null =
    manual.data?.find((deadline) => deadline.id === openManualId) ?? null

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([manual.refetch(), campusVirtual.refetch(), me.refetch()])
    setRefreshing(false)
  }

  const open = (item: DueItem) => {
    if (item.kind === 'manual') setOpenManualId(item.deadline.id)
    else setOpenCampusVirtual(item.deadline)
  }

  const upcoming = dueList(campusVirtual.data, manual.data)
  const done = doneList(manual.data)
  const row = (item: DueItem) => (
    <DueRow
      key={item.key}
      item={item}
      today={today}
      now={now.getTime()}
      onPress={() => open(item)}
    />
  )

  let body
  if (manual.isPending && campusVirtual.isPending) {
    body = <LoadingState />
  } else if (manual.isError && !manual.data && upcoming.length === 0) {
    body = <ErrorState error={manual.error} onRetry={() => void manual.refetch()} />
  } else if (upcoming.length === 0 && done.length === 0) {
    body = manual.isPending ? (
      <LoadingState />
    ) : (
      <EmptyState title={t('deadlines.screen.empty')} about={t('deadlines.screen.emptyAbout')} />
    )
  } else {
    body = (
      <View style={styles.list}>
        {upcoming.length === 0 ? (
          <Text style={styles.muted}>{t('deadlines.screen.nothingUpcoming')}</Text>
        ) : (
          upcoming.map(row)
        )}
        {done.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            onPress={() => setShowDone(!showDone)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <Text style={styles.toggleLabel}>{t('deadlines.screen.done', { n: done.length })}</Text>
            <Text style={styles.toggleAction}>
              {showDone ? t('assignments.hidePast') : t('assignments.showPast')}
            </Text>
          </Pressable>
        ) : null}
        {showDone ? done.map(row) : null}
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
          title={t('deadlines.screen.title')}
          subtitle={t('deadlines.screen.about')}
          large
          fallback="/"
        />
        <UptNudge />
        <Button label={t('deadlines.own.add')} onPress={() => router.push('/deadline/new')} />
        {manual.data ? <ManualProblem manual={manual} /> : null}
        <CampusVirtualLine campusVirtual={campusVirtual} uptLinked={me.data?.uptLinked} />
        {body}
      </ScrollView>
      <DeadlineSheet deadline={openCampusVirtual} onClose={() => setOpenCampusVirtual(null)} />
      <ManualDeadlineSheet deadline={openManual} onClose={() => setOpenManualId(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  list: { gap: space.sm },
  muted: { ...type.bodySmall, color: color.inkMuted },
  toggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.sm,
  },
  toggleLabel: { ...type.label, color: color.inkSoft, flex: 1 },
  toggleAction: { ...type.label, color: color.accent },
  pressed: { opacity: 0.6 },
})
