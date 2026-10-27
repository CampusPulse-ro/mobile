import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, radius, space, type } from '@/theme'

const STEPS = ['programme', 'group', 'subjects'] as const

/**
 * The top of each timetable setup step: back, the flow's title, a three-part progress bar,
 * "Step n of 3 · Programme", and the step's heading and explanation.
 */
export function SetupHeader({
  step,
  heading,
  about,
}: {
  step: 1 | 2 | 3
  heading: string
  about?: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const name = STEPS[step - 1] ?? 'programme'

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('setup.back')}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} accessibilityRole="header">
          {t('setup.title')}
        </Text>
      </View>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: STEPS.length, now: step }}
      >
        {STEPS.map((stepName, index) => (
          <View key={stepName} style={[styles.segment, index < step && styles.segmentDone]} />
        ))}
      </View>
      <Text style={styles.step}>
        {t('setup.step', { n: step, name: t(`setup.steps.${name}`) })}
      </Text>
      <Text style={styles.heading}>{heading}</Text>
      {about ? <Text style={styles.about}>{about}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: space.sm, paddingBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -space.sm },
  backText: { ...type.title, color: color.ink, paddingLeft: space.sm },
  pressed: { opacity: 0.6 },
  title: { ...type.heading, color: color.ink },
  progress: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: color.line },
  segmentDone: { backgroundColor: color.accent },
  step: { ...type.caption, color: color.inkMuted },
  heading: { ...type.heading, color: color.ink },
  about: { ...type.bodySmall, color: color.inkMuted },
})
