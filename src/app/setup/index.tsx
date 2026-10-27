import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'

import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Screen } from '@/components/ui'
import { space } from '@/theme'
import { useProgrammes, useSettings } from '@/timetable'
import { ChoiceList, ChoiceRow } from '@/timetable/Choice'
import { SetupHeader } from '@/timetable/SetupHeader'

/** Setup step 1: the programme. Tapping one goes on to its years and groups. */
export default function ProgrammeStep() {
  const { t } = useTranslation()
  const router = useRouter()
  const programmes = useProgrammes()
  const settings = useSettings()
  const current = settings.data?.studyGroup?.programmeCode

  let body
  if (programmes.isPending) {
    body = <LoadingState />
  } else if (programmes.isError && !programmes.data) {
    body = <ErrorState error={programmes.error} onRetry={() => void programmes.refetch()} />
  } else if (programmes.data.length === 0) {
    body = <EmptyState title={t('setup.noProgrammes')} about={t('setup.noProgrammesAbout')} />
  } else {
    body = (
      <ChoiceList>
        {programmes.data.map((programme, index) => (
          <ChoiceRow
            key={programme.code}
            role="button"
            title={programme.name}
            subtitle={programme.code}
            selected={programme.code === current}
            last={index === programmes.data.length - 1}
            onPress={() =>
              router.push({ pathname: '/setup/group', params: { programme: programme.code } })
            }
          />
        ))}
      </ChoiceList>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <SetupHeader
          step={1}
          heading={t('setup.programme.heading')}
          about={t('setup.programme.about')}
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
    gap: space.md,
  },
})
