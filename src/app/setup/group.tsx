import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import { color, space, type } from '@/theme'
import { useProgrammes, useSettings } from '@/timetable'
import { Chip } from '@/timetable/Choice'
import { SetupHeader } from '@/timetable/SetupHeader'

/** Setup step 2: the year, then the study group within it. */
export default function GroupStep() {
  const { t } = useTranslation()
  const router = useRouter()
  const { programme: code } = useLocalSearchParams<{ programme?: string }>()
  const programmes = useProgrammes()
  const settings = useSettings()
  const [chosenYear, setChosenYear] = useState<number | null>(null)
  const [chosenGroup, setChosenGroup] = useState<string | null>(null)

  const programme = programmes.data?.find((p) => p.code === code)
  const years = programme?.years ?? []
  // Start from the student's current group when it's in this programme, or the only option.
  const current = settings.data?.studyGroup
  const currentHere = current && current.programmeCode === code ? current : null
  const year =
    chosenYear ?? currentHere?.year ?? (years.length === 1 ? (years[0]?.year ?? null) : null)
  const groups = years.find((y) => y.year === year)?.groups ?? []
  const groupId =
    chosenGroup ??
    (currentHere && groups.some((g) => g.id === currentHere.id) ? currentHere.id : null) ??
    (groups.length === 1 ? (groups[0]?.id ?? null) : null)

  let body
  if (programmes.isPending) {
    body = <LoadingState />
  } else if (programmes.isError && !programmes.data) {
    body = <ErrorState error={programmes.error} onRetry={() => void programmes.refetch()} />
  } else if (!programme || years.length === 0) {
    body = <EmptyState title={t('setup.group.noGroups')} />
  } else {
    body = (
      <>
        <Text style={styles.label}>{t('setup.group.year')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {years.map((y) => (
            <Chip
              key={y.year}
              label={t('setup.group.yearN', { year: y.year })}
              selected={y.year === year}
              onPress={() => {
                setChosenYear(y.year)
                setChosenGroup(null)
              }}
            />
          ))}
        </View>

        {year !== null ? (
          <>
            <Text style={styles.label}>{t('setup.group.group')}</Text>
            <Text style={styles.hint}>{t('setup.group.groupAbout')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {groups.map((group) => (
                <Chip
                  key={group.id}
                  label={group.label}
                  selected={group.id === groupId}
                  onPress={() => setChosenGroup(group.id)}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>{t('setup.group.pickYear')}</Text>
        )}
      </>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <SetupHeader step={2} heading={t('setup.group.heading')} about={programme?.name} />
        {body}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {groupId ? (
          <Button
            label={t('setup.continue')}
            onPress={() => router.push({ pathname: '/setup/subjects', params: { groupId } })}
          />
        ) : null}
        <Text style={styles.hint}>{t('setup.group.next')}</Text>
      </SafeAreaView>
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
  label: { ...type.label, color: color.inkSoft, marginTop: space.sm },
  hint: { ...type.caption, color: color.inkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
})
