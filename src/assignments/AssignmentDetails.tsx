import { useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  allowedActions,
  CampusVirtualExpiredError,
  checkFiles,
  checkText,
  hasEmbeddedFiles,
  countWords,
  type AssignmentRules,
  type SubmissionFile,
  type SubmissionState,
} from '@/campusVirtual'
import { SheetField } from '@/components/BottomSheet'
import { Pill } from '@/components/States'
import { Button } from '@/components/ui'
import { color, radius, space, type } from '@/theme'
import { useNow } from '@/timetable'

import { freshSubmission, useSaveSubmission, useSubmitForGrading } from './api'
import { ActionButton, OutcomeNote, StatementSwitch, openInCampusVirtual } from './parts'
import { pickFiles } from './pickFiles'
import { hasFormatting, saveInput, type SaveInput } from './submission'
import { useAssignmentText, type Outcome } from './text'

/** What Moodle allows at this moment, for a submission just read again before a confirmation. */
function allowedNow(rules: AssignmentRules, state: SubmissionState) {
  return allowedActions(rules, state, Date.now())
}

/**
 * One assignment: its dates, the student's submission as Campus Virtual holds it and, only when
 * Moodle allows it now, editing it and submitting it for grading.
 *
 * Every write starts from a tap, reads the submission again, and asks first in a confirmation that
 * names the assignment, the course and what changes (Cancel is the default); submitting for grading
 * asks twice. `saveSubmission`/`submitForGrading` check everything again themselves. What the
 * screen shows afterwards is the submission Campus Virtual returns when read after the write.
 */
export function AssignmentDetails({
  rules,
  submission,
}: {
  rules: AssignmentRules
  submission: UseQueryResult<SubmissionState | null>
}) {
  const { t } = useTranslation()
  const now = useNow().getTime()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const state = submission.data ?? null

  const expired = submission.error instanceof CampusVirtualExpiredError
  let body
  if (expired || (!submission.isPending && submission.data === null)) {
    // No token any more: an old copy would offer edits that can't be sent.
    body = <NotConnected expired={expired} />
  } else if (state) {
    body = (
      <>
        {submission.isError ? <Text style={styles.stale}>{t('states.refreshFailed')}</Text> : null}
        <Submission rules={rules} state={state} now={now} />
        <Actions rules={rules} state={state} now={now} onOutcome={setOutcome} />
      </>
    )
  } else if (submission.isPending) {
    body = (
      <View style={styles.line}>
        <ActivityIndicator color={color.inkMuted} />
        <Text style={styles.muted}>{t('assignments.detail.loadingSubmission')}</Text>
      </View>
    )
  } else {
    body = (
      <View style={styles.section}>
        <Text style={styles.problem}>{t('assignments.detail.submissionFailed')}</Text>
        <Button
          label={t('assignments.retry')}
          variant="secondary"
          onPress={() => void submission.refetch()}
        />
      </View>
    )
  }

  return (
    <View style={styles.details}>
      <Dates rules={rules} state={state} now={now} />
      {body}
      {outcome ? <OutcomeNote outcome={outcome} /> : null}
      <Button
        label={t('assignments.detail.openInCampusVirtual')}
        variant="secondary"
        onPress={() => openInCampusVirtual(rules.cmid)}
      />
    </View>
  )
}

/** Opens, due, cut-off and the student's extension, whichever are set. */
function Dates({
  rules,
  state,
  now,
}: {
  rules: AssignmentRules
  state: SubmissionState | null
  now: number
}) {
  const { t } = useTranslation()
  const text = useAssignmentText()
  const extension = state?.extensionDueAt ?? null
  return (
    <View style={styles.section}>
      {rules.opensAt !== null ? (
        <SheetField value={text.when(rules.opensAt, now)} label={t('assignments.detail.opens')} />
      ) : null}
      <SheetField
        value={rules.dueAt !== null ? text.when(rules.dueAt, now) : t('assignments.row.noDueDate')}
        label={t('assignments.detail.due')}
      />
      {rules.cutoffAt !== null ? (
        <SheetField value={text.when(rules.cutoffAt, now)} label={t('assignments.detail.cutoff')} />
      ) : null}
      {extension !== null ? (
        <SheetField value={text.when(extension, now)} label={t('assignments.detail.extension')} />
      ) : null}
    </View>
  )
}

/** The submission as Campus Virtual holds it: status, when it changed, the text and the files. */
function Submission({
  rules,
  state,
  now,
}: {
  rules: AssignmentRules
  state: SubmissionState
  now: number
}) {
  const { t } = useTranslation()
  const text = useAssignmentText()
  const started = state.status !== 'none' && state.status !== 'new'
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('assignments.detail.submission')}
      </Text>
      <View style={styles.pills}>
        <Pill label={text.status(state)} accent={state.status === 'submitted'} />
        {state.graded ? <Pill label={t('assignments.status.graded')} accent /> : null}
      </View>
      {started && state.modifiedAt !== null ? (
        <Text style={styles.caption}>
          {t('assignments.detail.lastModified', { when: text.when(state.modifiedAt, now) })}
        </Text>
      ) : null}
      {rules.onlineText || state.text ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('assignments.detail.onlineText')}</Text>
          {state.text ? (
            <Text selectable style={styles.submittedText}>
              {state.text}
            </Text>
          ) : (
            <Text style={styles.muted}>{t('assignments.detail.noText')}</Text>
          )}
        </View>
      ) : null}
      {rules.files || state.files.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('assignments.detail.files')}</Text>
          {state.files.length === 0 ? (
            <Text style={styles.muted}>{t('assignments.detail.noFiles')}</Text>
          ) : (
            state.files.map((file, index) => (
              <Text key={`${file.name}-${index}`} style={styles.fileLine}>
                {`${file.name} · ${text.size(file.bytes)}`}
              </Text>
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}

/**
 * Editing and submitting for grading, only as far as `allowedActions` (Moodle's own answer plus
 * the dates) allows; otherwise the reason in one line. Edits live here until they're saved.
 */
function Actions({
  rules,
  state,
  now,
  onOutcome,
}: {
  rules: AssignmentRules
  state: SubmissionState
  now: number
  onOutcome: (outcome: Outcome | null) => void
}) {
  const { t } = useTranslation()
  const text = useAssignmentText()
  const queryClient = useQueryClient()
  const save = useSaveSubmission()
  const grade = useSubmitForGrading()
  const [draftText, setDraftText] = useState<string | null>(null)
  const [picked, setPicked] = useState<SubmissionFile[]>([])
  const [statementAccepted, setStatementAccepted] = useState(false)
  const [checking, setChecking] = useState<'save' | 'grade' | null>(null)
  const [pickerNote, setPickerNote] = useState<string | null>(null)
  // Set from the first tap until its confirmation is shown: a second tap in between does nothing.
  const confirming = useRef(false)

  const can = allowedActions(rules, state, now)
  const busy = checking !== null || save.isPending || grade.isPending
  const course = text.course(rules)

  // What would be sent (see saveInput).
  const currentText = draftText ?? state.text
  const { input, textChanged } = saveInput(rules, state, draftText, picked)
  const sendsFiles = input.files !== undefined
  const changed = textChanged || sendsFiles
  const overLimit = checkText(currentText, rules)
  const fileProblems = sendsFiles ? checkFiles(picked, rules) : []
  // The stored text has formatting the app's plain text can't keep.
  const formatted = rules.onlineText !== null && hasFormatting(state.textHtml)
  // Without drafts, saving IS submitting: the statement is accepted before it, as on the website.
  const saveNeedsStatement = !rules.drafts && rules.statement !== null
  const embedded = rules.onlineText !== null && hasEmbeddedFiles(state.textHtml)
  const saveBlock = embedded
    ? t('assignments.edit.embeddedFiles')
    : !changed
      ? t('assignments.edit.noChanges')
      : (input.text !== undefined && overLimit) || fileProblems.length > 0
        ? t('assignments.edit.fixProblems')
        : saveNeedsStatement && !statementAccepted
          ? t('assignments.edit.acceptStatement')
          : null
  const saveLabel = rules.drafts
    ? t('assignments.edit.saveDraft')
    : t('assignments.edit.saveAndSubmit')

  /** The submission read again for a confirmation; null after telling the student why not. */
  const readAgain = async (step: 'save' | 'grade'): Promise<SubmissionState | null> => {
    onOutcome(null)
    setChecking(step)
    try {
      const fresh = await freshSubmission(queryClient, rules.id)
      if (!fresh) onOutcome({ ok: false, text: t('assignments.outcome.notConnectedBefore') })
      return fresh
    } catch (error) {
      onOutcome(text.failureBefore(error))
      return null
    } finally {
      setChecking(null)
    }
  }

  const confirmSave = async () => {
    if (busy || saveBlock !== null || confirming.current) return
    confirming.current = true
    try {
      await prepareSave()
    } finally {
      confirming.current = false
    }
  }

  const prepareSave = async () => {
    const fresh = await readAgain('save')
    if (!fresh) return
    if (!allowedNow(rules, fresh).edit) {
      onOutcome({ ok: false, text: t('assignments.outcome.notAllowed') })
      return
    }
    const values = { name: rules.name, course }
    const resubmits = !rules.drafts && fresh.status === 'submitted'
    const replaced = input.files ? fresh.files.length : 0
    const lines = [
      rules.drafts
        ? t('assignments.confirm.draft', values)
        : resubmits
          ? t('assignments.confirm.change', values)
          : t('assignments.confirm.submit', values),
      textChanged && input.text !== undefined
        ? input.text.trim() === ''
          ? t('assignments.confirm.textCleared')
          : t('assignments.confirm.text', { n: countWords(input.text) })
        : null,
      textChanged && formatted ? t('assignments.confirm.formattingLost') : null,
      input.files
        ? t('assignments.confirm.files', { names: input.files.map((f) => f.name).join(', ') })
        : null,
      replaced === 1
        ? t('assignments.confirm.replacesOne')
        : replaced > 1
          ? t('assignments.confirm.replacesMany', { n: replaced })
          : null,
    ]
    Alert.alert(
      rules.drafts
        ? t('assignments.confirm.draftTitle')
        : resubmits
          ? t('assignments.confirm.changeTitle')
          : t('assignments.confirm.submitTitle'),
      lines.filter(Boolean).join('\n\n'),
      [
        { text: t('assignments.cancel'), style: 'cancel', isPreferred: true },
        { text: saveLabel, onPress: () => write(input) },
      ],
      { cancelable: true },
    )
  }

  const write = (sent: SaveInput) => {
    save.mutate(
      { rules, input: { ...sent, acceptStatement: statementAccepted } },
      {
        onSuccess: (after) => {
          setDraftText(null)
          setPicked([])
          setStatementAccepted(false)
          setPickerNote(null)
          const expected = rules.drafts ? 'draft' : 'submitted'
          onOutcome(
            after.status === expected
              ? {
                  ok: true,
                  text: rules.drafts
                    ? t('assignments.outcome.draftSaved')
                    : t('assignments.outcome.submitted'),
                }
              : { ok: false, text: t('assignments.outcome.notRecorded') },
          )
        },
        onError: (error) => onOutcome(text.failure(error)),
      },
    )
  }

  const confirmGrading = async () => {
    if (busy || changed || (rules.statement !== null && !statementAccepted) || confirming.current)
      return
    confirming.current = true
    try {
      await prepareGrading()
    } finally {
      confirming.current = false
    }
  }

  const prepareGrading = async () => {
    const fresh = await readAgain('grade')
    if (!fresh) return
    if (!allowedNow(rules, fresh).submitForGrading) {
      onOutcome({ ok: false, text: t('assignments.outcome.notAllowed') })
      return
    }
    const accepted = rules.statement !== null && statementAccepted
    const cancel = { text: t('assignments.cancel'), style: 'cancel' as const, isPreferred: true }
    Alert.alert(
      t('assignments.grading.confirmTitle'),
      t('assignments.grading.confirm', { name: rules.name, course }),
      [
        cancel,
        {
          text: t('assignments.grading.continue'),
          onPress: () =>
            Alert.alert(
              t('assignments.grading.finalTitle'),
              t('assignments.grading.final'),
              [cancel, { text: t('assignments.grading.button'), onPress: () => submit(accepted) }],
              { cancelable: true },
            ),
        },
      ],
      { cancelable: true },
    )
  }

  const submit = (acceptStatement: boolean) => {
    grade.mutate(
      { rules, acceptStatement },
      {
        onSuccess: (after) => {
          setStatementAccepted(false)
          onOutcome(
            after.status === 'submitted'
              ? { ok: true, text: t('assignments.outcome.submittedForGrading') }
              : { ok: false, text: t('assignments.outcome.notRecorded') },
          )
        },
        onError: (error) => onOutcome(text.failure(error)),
      },
    )
  }

  const choose = async () => {
    setPickerNote(null)
    const result = await pickFiles()
    if (result.kind === 'unavailable') setPickerNote(t('assignments.edit.pickerUnavailable'))
    else if (result.kind === 'failed') setPickerNote(t('assignments.edit.pickerFailed'))
    else if (result.kind === 'picked') {
      // A file picked again under the same name replaces the earlier pick.
      setPicked((current) => [
        ...current.filter((file) => !result.files.some((next) => next.name === file.name)),
        ...result.files,
      ])
    }
  }

  if (!can.edit && !can.submitForGrading) {
    return can.reason ? (
      <Text style={styles.reason}>{text.reason(can.reason, rules, state, now)}</Text>
    ) : null
  }

  const words = countWords(currentText)
  const limit = rules.onlineText?.wordLimit ?? null
  const tooMany = fileProblems.find((p) => p.kind === 'tooMany')

  return (
    <>
      {can.edit ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t('assignments.edit.heading')}
          </Text>
          {!rules.drafts && state.status === 'submitted' ? (
            <Text style={styles.muted}>{t('assignments.edit.resubmitAbout')}</Text>
          ) : null}

          {rules.onlineText ? (
            <View style={styles.block}>
              <Text style={styles.label}>{t('assignments.detail.onlineText')}</Text>
              {formatted ? (
                <Text style={styles.warn}>{t('assignments.edit.formattedText')}</Text>
              ) : null}
              <TextInput
                multiline
                value={currentText}
                onChangeText={setDraftText}
                editable={!busy}
                placeholder={t('assignments.edit.textPlaceholder')}
                placeholderTextColor={color.inkMuted}
                accessibilityLabel={t('assignments.detail.onlineText')}
                textAlignVertical="top"
                style={styles.input}
              />
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.caption, overLimit && styles.over]}
              >
                {limit !== null
                  ? t('assignments.edit.wordsLimit', { n: words, limit })
                  : t('assignments.edit.words', { n: words })}
              </Text>
              {overLimit ? <Text style={styles.over}>{text.problem(overLimit)}</Text> : null}
            </View>
          ) : null}

          {rules.files ? (
            <View style={styles.block}>
              <Text style={styles.label}>{t('assignments.detail.files')}</Text>
              <Text style={styles.caption}>{text.limits(rules.files)}</Text>
              {picked.map((file) => (
                <PickedFileRow
                  key={file.uri}
                  file={file}
                  problems={fileProblems
                    .filter((p) => 'name' in p && p.name === file.name)
                    .map(text.problem)}
                  disabled={busy}
                  onRemove={() =>
                    setPicked((current) => current.filter((other) => other.uri !== file.uri))
                  }
                />
              ))}
              {tooMany ? <Text style={styles.over}>{text.problem(tooMany)}</Text> : null}
              {sendsFiles && state.files.length > 0 ? (
                <Text style={styles.warn}>
                  {state.files.length === 1
                    ? t('assignments.edit.replacesOne')
                    : t('assignments.edit.replacesMany', { n: state.files.length })}
                </Text>
              ) : null}
              <ActionButton
                label={t('assignments.edit.chooseFiles')}
                variant="secondary"
                disabled={busy}
                onPress={() => void choose()}
              />
              {pickerNote ? <Text style={styles.warn}>{pickerNote}</Text> : null}
            </View>
          ) : null}

          {saveNeedsStatement ? (
            <StatementSwitch
              statement={rules.statement || t('assignments.statementFallback')}
              value={statementAccepted}
              onChange={setStatementAccepted}
              disabled={busy}
            />
          ) : null}

          <ActionButton
            label={saveLabel}
            busy={save.isPending || checking === 'save'}
            disabled={busy || saveBlock !== null}
            onPress={() => void confirmSave()}
          />
          {saveBlock !== null && (changed || embedded) ? (
            <Text style={styles.caption}>{saveBlock}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.reason}>
          {can.reason ? text.reason(can.reason, rules, state, now) : null}
        </Text>
      )}

      {can.submitForGrading ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t('assignments.grading.heading')}
          </Text>
          <Text style={styles.muted}>{t('assignments.grading.about')}</Text>
          {rules.statement !== null ? (
            <StatementSwitch
              statement={rules.statement || t('assignments.statementFallback')}
              value={statementAccepted}
              onChange={setStatementAccepted}
              disabled={busy}
            />
          ) : null}
          {changed ? <Text style={styles.warn}>{t('assignments.grading.saveFirst')}</Text> : null}
          <ActionButton
            label={t('assignments.grading.button')}
            busy={grade.isPending || checking === 'grade'}
            disabled={busy || changed || (rules.statement !== null && !statementAccepted)}
            onPress={() => void confirmGrading()}
          />
          {rules.statement !== null && !statementAccepted && !changed ? (
            <Text style={styles.caption}>{t('assignments.grading.acceptFirst')}</Text>
          ) : null}
        </View>
      ) : null}
    </>
  )
}

/** A picked file waiting to be saved: its name and size, what's wrong with it, and Remove. */
function PickedFileRow({
  file,
  problems,
  disabled,
  onRemove,
}: {
  file: SubmissionFile
  problems: string[]
  disabled: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const text = useAssignmentText()
  return (
    <View style={[styles.picked, problems.length > 0 && styles.pickedProblem]}>
      <View style={styles.pickedText}>
        <Text style={styles.fileLine} numberOfLines={2}>
          {file.name}
        </Text>
        <Text style={styles.caption}>
          {file.bytes !== null ? text.size(file.bytes) : t('assignments.edit.sizeUnknown')}
        </Text>
        {problems.map((problem) => (
          <Text key={problem} style={styles.over}>
            {problem}
          </Text>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('assignments.edit.removeFile', { name: file.name })}
        disabled={disabled}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        <Text style={styles.removeText}>{'×'}</Text>
      </Pressable>
    </View>
  )
}

/** Campus Virtual isn't connected (or the connection expired): it's fixed on Profile. */
export function NotConnected({ expired }: { expired: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <View style={styles.section}>
      <Text style={styles.problem}>
        {expired ? t('assignments.expiredAbout') : t('assignments.notConnectedAbout')}
      </Text>
      <Button
        label={t('assignments.goToProfile')}
        variant="secondary"
        onPress={() => router.navigate('/profile')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  details: { gap: space.lg },
  section: { gap: space.md },
  block: { gap: space.sm },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  heading: { ...type.subtitle, color: color.ink },
  label: { ...type.label, color: color.inkSoft },
  caption: { ...type.caption, color: color.inkMuted },
  muted: { ...type.bodySmall, color: color.inkMuted },
  problem: { ...type.bodySmall, color: color.warn },
  warn: { ...type.bodySmall, color: color.warn },
  over: { ...type.bodySmall, color: color.danger },
  stale: { ...type.caption, color: color.warn },
  reason: { ...type.body, color: color.inkSoft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  submittedText: {
    ...type.body,
    color: color.ink,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  fileLine: { ...type.bodySmall, color: color.ink },
  input: {
    ...type.body,
    minHeight: 160,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunken,
    color: color.ink,
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunken,
  },
  pickedProblem: { borderColor: color.danger },
  pickedText: { flex: 1, gap: 2, paddingVertical: space.sm },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { ...type.heading, color: color.inkMuted },
  pressed: { opacity: 0.6 },
})
