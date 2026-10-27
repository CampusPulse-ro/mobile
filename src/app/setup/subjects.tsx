import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Button, Screen } from '@/components/ui'
import { useDateTimeFormat } from '@/i18n/format'
import { color, radius, space, type } from '@/theme'
import {
  addDays,
  campusInstant,
  campusToday,
  mondayOf,
  useClassText,
  useGroupChoices,
  useMySubjects,
  useSaveSetup,
  useSemester,
  type ChoiceSubject,
  type DayOfWeek,
  type OfferedSlot,
} from '@/timetable'
import { ChoiceRow } from '@/timetable/Choice'
import { SetupHeader } from '@/timetable/SetupHeader'

/** Whether a subject is taken, and at which offered slot (null: none picked yet). */
type SubjectState = { on: boolean; slot: string | null }

const DAYS_FROM_MONDAY: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

/**
 * Setup step 3: the subjects this group chooses. `optional` ones are turned on or off;
 * `pickSlot` ones (everyone takes them) need one of the offered times. Skip saves only the group.
 */
export default function SubjectsStep() {
  const { t } = useTranslation()
  const router = useRouter()
  const format = useDateTimeFormat()
  const text = useClassText()
  const { groupId = '' } = useLocalSearchParams<{ groupId?: string }>()
  const choices = useGroupChoices(groupId)
  const mine = useMySubjects()
  const semester = useSemester()
  const save = useSaveSetup()
  const [changed, setChanged] = useState<Record<string, SubjectState>>({})

  const subjects = (choices.data ?? []).filter((s) => s.choice !== 'fixed')
  const mustPick = subjects.filter((s) => s.choice === 'pickSlot')
  const optional = subjects.filter((s) => s.choice === 'optional')
  const allWeeks = semester.data?.weeks.length ?? 0

  /** What's on screen for a subject: the student's change, else what they saved, else a default. */
  const pickOf = (subject: ChoiceSubject): SubjectState => {
    const local = changed[subject.id]
    if (local) return local
    const saved = mine.data?.find((s) => s.subjectId === subject.id)
    const savedSlot = subject.offers.some((o) => o.id === saved?.offeredSlotId)
      ? (saved?.offeredSlotId ?? null)
      : null
    const onlyOffer = subject.offers.length === 1 ? (subject.offers[0]?.id ?? null) : null
    return {
      on: subject.choice === 'pickSlot' || Boolean(saved),
      slot: savedSlot ?? onlyOffer,
    }
  }
  const setPick = (subject: ChoiceSubject, pick: SubjectState) =>
    setChanged((previous) => ({ ...previous, [subject.id]: pick }))

  // Any week shows the right weekday name and time; this one is as good as another.
  const monday = mondayOf(campusToday())
  const describeOffer = (offer: OfferedSlot) => {
    const date = addDays(monday, DAYS_FROM_MONDAY[offer.weekday])
    const when = `${format.weekday(campusInstant(date, '12:00'))} ${format.timeRange(
      campusInstant(date, offer.startsAt),
      campusInstant(date, offer.endsAt),
    )}`
    const weeks =
      offer.weeks.length > 0 && offer.weeks.length < allWeeks
        ? t('setup.subjects.weeks', { weeks: offer.weeks.join(', ') })
        : null
    return {
      title: when,
      subtitle: [text.kinds(offer.kinds), offer.room, weeks].filter(Boolean).join(' · '),
    }
  }

  const finish = (withSubjects: boolean) => {
    const picks = withSubjects
      ? subjects
          .filter((s) => {
            const pick = pickOf(s)
            return pick.on && (s.choice === 'optional' || pick.slot !== null)
          })
          .map((s) => ({ subjectId: s.id, offeredSlotId: pickOf(s).slot }))
      : []
    // A subject everyone takes at a time they pick can't be left without a time: say which.
    const missingTime = withSubjects
      ? subjects.filter(
          (s) => s.choice === 'pickSlot' && s.offers.length > 0 && pickOf(s).slot === null,
        )
      : []
    if (missingTime.length > 0) {
      Alert.alert(
        t('setup.subjects.missingTimeTitle'),
        t('setup.subjects.missingTime', { subjects: missingTime.map((s) => s.name).join(', ') }),
      )
      return
    }
    // Drop every saved pick that no longer applies: turned off here, or (after a group change)
    // a subject the new group doesn't offer. Skip keeps the picks the new group still has.
    const pickedIds = new Set(picks.map((p) => p.subjectId))
    const offeredIds = new Set(subjects.map((s) => s.id))
    const drops = (mine.data ?? [])
      .filter((m) => (withSubjects ? !pickedIds.has(m.subjectId) : !offeredIds.has(m.subjectId)))
      .map((m) => m.subjectId)
    save.mutate({ groupId, picks, drops }, { onSuccess: () => router.replace('/') })
  }

  const renderSubject = (subject: ChoiceSubject) => {
    const pick = pickOf(subject)
    const picked = subject.offers.find((o) => o.id === pick.slot)
    const summary = picked
      ? [describeOffer(picked).title, picked.room].filter(Boolean).join(' · ')
      : pick.on && subject.offers.length > 0
        ? t('setup.subjects.pickTime')
        : t('setup.subjects.notPicked')
    const toggle = () => setPick(subject, { ...pick, on: !pick.on })
    return (
      <View key={subject.id} style={styles.subject}>
        {subject.choice === 'optional' ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: pick.on }}
            accessibilityLabel={`${subject.name}, ${summary}`}
            onPress={toggle}
            style={styles.subjectHeader}
          >
            <View style={styles.subjectText}>
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Text style={styles.subjectSummary}>{summary}</Text>
            </View>
            <Switch
              value={pick.on}
              onValueChange={toggle}
              trackColor={{ false: color.line, true: color.accent }}
              thumbColor={color.ink}
              importantForAccessibility="no"
            />
          </Pressable>
        ) : (
          <View style={styles.subjectHeader} accessible>
            <View style={styles.subjectText}>
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Text style={styles.subjectSummary}>{summary}</Text>
            </View>
          </View>
        )}
        {pick.on && subject.offers.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.offers}>
            {subject.offers.map((offer, index) => {
              const { title, subtitle } = describeOffer(offer)
              return (
                <ChoiceRow
                  key={offer.id}
                  title={title}
                  subtitle={subtitle}
                  selected={offer.id === pick.slot}
                  last={index === subject.offers.length - 1}
                  onPress={() => setPick(subject, { on: true, slot: offer.id })}
                />
              )
            })}
          </View>
        ) : null}
      </View>
    )
  }

  let body
  if (choices.isPending || mine.isPending) {
    body = <LoadingState />
  } else if (choices.isError && !choices.data) {
    body = <ErrorState error={choices.error} onRetry={() => void choices.refetch()} />
  } else if (subjects.length === 0) {
    body = <EmptyState title={t('setup.subjects.none')} about={t('setup.subjects.noneAbout')} />
  } else {
    const pickedCount = optional.filter((s) => pickOf(s).on).length
    body = (
      <>
        {mustPick.length > 0 ? (
          <>
            <Text style={styles.section}>{t('setup.subjects.everyonePicks')}</Text>
            {mustPick.map(renderSubject)}
          </>
        ) : null}
        {optional.length > 0 ? (
          <>
            <Text style={styles.section}>
              {t('setup.subjects.optional', { picked: pickedCount, total: optional.length })}
            </Text>
            {optional.map(renderSubject)}
          </>
        ) : null}
      </>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <SetupHeader
          step={3}
          heading={t('setup.subjects.heading')}
          about={t('setup.subjects.about')}
        />
        {body}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {save.isError ? <Text style={styles.problem}>{t('setup.saveFailed')}</Text> : null}
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button
              label={t('setup.skip')}
              variant="secondary"
              busy={save.isPending}
              onPress={() => finish(false)}
            />
          </View>
          <View style={styles.button}>
            <Button label={t('setup.done')} busy={save.isPending} onPress={() => finish(true)} />
          </View>
        </View>
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
  section: {
    ...type.caption,
    color: color.inkMuted,
    marginTop: space.sm,
    textTransform: 'uppercase',
  },
  subject: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
    overflow: 'hidden',
  },
  subjectHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  subjectText: { flex: 1, gap: 2 },
  offers: { borderTopWidth: 1, borderTopColor: color.line },
  subjectName: { ...type.body, color: color.ink },
  subjectSummary: { ...type.caption, color: color.inkMuted },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
  buttons: { flexDirection: 'row', gap: space.md },
  button: { flex: 1 },
  problem: { ...type.bodySmall, color: color.warn },
})
