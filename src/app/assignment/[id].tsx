import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'

import {
  AssignmentDetails,
  BackHeader,
  NotConnected,
  openInCampusVirtual,
  useAssignments,
  useAssignmentText,
  useSubmission,
} from '@/assignments'
import { CampusVirtualExpiredError } from '@/campusVirtual'
import { EmptyState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import { color, space } from '@/theme'

/** A positive whole number from a route param, or null. */
function idParam(value: string | string[] | undefined): number | null {
  const number = typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(number) && number > 0 ? number : null
}

/**
 * One Campus Virtual assignment (`/assignment/<id>?cmid=<cmid>`): its rules come from the
 * assignments list, its submission is loaded here. `cmid` keeps "Open in Campus Virtual" working
 * when the assignment can't be found in the list.
 */
export default function AssignmentScreen() {
  const { t } = useTranslation()
  const text = useAssignmentText()
  const params = useLocalSearchParams<{ id: string; cmid?: string }>()
  const id = idParam(params.id)
  const assignments = useAssignments()
  const submission = useSubmission(id)
  const rules = id === null ? null : (assignments.data?.find((a) => a.id === id) ?? null)
  const cmid = rules?.cmid ?? idParam(params.cmid)
  const [refreshing, setRefreshing] = useState(false)

  // Pull to read both again: after an uncertain write, this is how to see what Campus Virtual holds.
  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([assignments.refetch(), submission.refetch()])
    setRefreshing(false)
  }

  let body
  if (rules) {
    // Found: shown even when a later reload of the list fails, so nothing typed is lost.
    body = <AssignmentDetails rules={rules} submission={submission} />
  } else if (assignments.isPending && id !== null) {
    body = <LoadingState />
  } else if (assignments.error instanceof CampusVirtualExpiredError || assignments.data === null) {
    body = <NotConnected expired={assignments.error instanceof CampusVirtualExpiredError} />
  } else if (assignments.isError && !assignments.data) {
    body = (
      <EmptyState title={t('assignments.loadFailed')} about={t('assignments.loadFailedAbout')}>
        <Button label={t('assignments.retry')} onPress={() => void assignments.refetch()} />
      </EmptyState>
    )
  } else {
    body = (
      <EmptyState title={t('assignments.notFound')} about={t('assignments.notFoundAbout')}>
        {cmid !== null ? (
          <Button
            label={t('assignments.detail.openInCampusVirtual')}
            variant="secondary"
            onPress={() => openInCampusVirtual(cmid)}
          />
        ) : null}
      </EmptyState>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
          title={rules?.name ?? t('assignments.assignment')}
          subtitle={rules ? text.course(rules) : undefined}
          fallback="/assignments"
        />
        {body}
      </ScrollView>
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
})
