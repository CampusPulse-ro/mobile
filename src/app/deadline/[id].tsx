import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'

import { BackHeader } from '@/assignments/parts'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import { useManualDeadlines } from '@/deadlines'
import { DeadlineForm } from '@/deadlines/DeadlineForm'
import { space } from '@/theme'

/** Editing one of the student's own deadlines, found in their list by its id. */
export default function EditDeadlineScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const deadlines = useManualDeadlines()
  const deadline = deadlines.data?.find((item) => item.id === id)

  if (deadline) {
    return (
      <Screen>
        <DeadlineForm key={deadline.id} deadline={deadline} />
      </Screen>
    )
  }

  let body
  if (deadlines.isPending) body = <LoadingState />
  else if (deadlines.isError && !deadlines.data) {
    body = <ErrorState error={deadlines.error} onRetry={() => void deadlines.refetch()} />
  } else {
    body = (
      <EmptyState title={t('deadlines.own.notFound')} about={t('deadlines.own.notFoundAbout')}>
        <Button label={t('deadlines.screen.title')} onPress={() => router.replace('/deadlines')} />
      </EmptyState>
    )
  }
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title={t('deadlines.form.editTitle')} fallback="/deadlines" />
        {body}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
})
