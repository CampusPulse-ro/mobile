import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { ApiError, problemType } from '@/api/client'
import { ActionButton } from '@/assignments/parts'
import { isLanguage } from '@/i18n'
import { color, radius, space, type } from '@/theme'

import { sendEmailCode, signInWithEmailCode } from './signIn'

const CODE_LENGTH = 6
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Sent = { email: string; expiresInMinutes: number; resendAt: number }

/**
 * "Or use your email": the address, then the 6-digit code from the email. The code field takes a
 * pasted code (spaces and dashes are dropped) and signs in as soon as it has six digits. Back (the
 * on-screen one or Android's) goes one step back; from the first step, `onCancel`.
 */
export function EmailSignIn({ onCancel }: { onCancel: () => void }) {
  const [sent, setSent] = useState<Sent | null>(null)

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sent) setSent(null)
      else onCancel()
      return true
    })
    return () => subscription.remove()
  }, [sent, onCancel])

  return sent ? (
    <CodeStep sent={sent} onResent={setSent} onBack={() => setSent(null)} />
  ) : (
    <EmailStep onSent={setSent} onBack={onCancel} />
  )
}

function useSendCode() {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)

  /** Sends a code; resolves what was sent, or the message saying why not. */
  async function send(email: string): Promise<Sent | string> {
    setBusy(true)
    try {
      const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
      const answer = await sendEmailCode(email, language)
      return {
        email,
        expiresInMinutes: Math.max(1, Math.round(answer.expiresInSeconds / 60)),
        resendAt: Date.now() + answer.resendAfterSeconds * 1000,
      }
    } catch (error) {
      const kind = problemType(error)
      if (kind === 'invalid-email') return t('auth.email.invalid')
      if (kind === 'too-many-codes') {
        const seconds = error instanceof ApiError ? (error.retryAfter ?? 60) : 60
        return t('auth.email.tooMany', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
      }
      if (error instanceof ApiError && error.status === 429) return t('auth.email.tooManyNetwork')
      if (error instanceof ApiError && error.status === 503) return t('auth.email.unavailable')
      return error instanceof ApiError ? t('api.serverError') : t('auth.unreachable')
    } finally {
      setBusy(false)
    }
  }

  return { send, busy }
}

function EmailStep({ onSent, onBack }: { onSent: (sent: Sent) => void; onBack: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const { send, busy } = useSendCode()

  async function submit() {
    const address = email.trim()
    if (busy) return
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      setProblem(t('auth.email.invalid'))
      return
    }
    setProblem(null)
    const result = await send(address)
    if (typeof result === 'string') setProblem(result)
    else onSent(result)
  }

  return (
    <View style={styles.step}>
      <BackLink onPress={onBack} />
      <Text accessibilityRole="header" style={styles.heading}>
        {t('auth.email.title')}
      </Text>
      <Text style={styles.about}>{t('auth.email.about')}</Text>
      <TextInput
        value={email}
        onChangeText={(value) => {
          setEmail(value)
          setProblem(null)
        }}
        onSubmitEditing={() => void submit()}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="send"
        placeholder={t('auth.email.placeholder')}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={t('auth.email.label')}
        style={[styles.input, problem !== null && styles.inputProblem]}
      />
      {problem ? (
        <Text accessibilityLiveRegion="polite" style={styles.problem}>
          {problem}
        </Text>
      ) : null}
      <ActionButton
        label={busy ? t('auth.email.sending') : t('auth.email.send')}
        busy={busy}
        disabled={email.trim() === ''}
        onPress={() => void submit()}
      />
    </View>
  )
}

function CodeStep({
  sent,
  onResent,
  onBack,
}: {
  sent: Sent
  onResent: (sent: Sent) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // A burned code can't be used any more: only a new one helps.
  const [burned, setBurned] = useState(false)
  const { send, busy: sending } = useSendCode()
  const input = useRef<TextInput>(null)

  // Seconds until another code may be asked for, ticking down once a second.
  const [now, setNow] = useState(() => Date.now())
  const wait = Math.max(0, Math.ceil((sent.resendAt - now) / 1000))
  useEffect(() => {
    if (wait === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [wait])

  async function verify(value: string) {
    if (checking) return
    setChecking(true)
    setProblem(null)
    setNote(null)
    try {
      await signInWithEmailCode(sent.email, value)
      // Signed in: the root layout moves on from this screen.
    } catch (error) {
      const kind = problemType(error)
      setCode('')
      if (kind === 'code-burned') {
        setBurned(true)
        setProblem(t('auth.code.burned'))
      } else if (kind === 'invalid-code') {
        setProblem(t('auth.code.invalid'))
        input.current?.focus()
      } else if (error instanceof ApiError && error.status === 429) {
        setProblem(t('auth.code.tooManyTries'))
      } else {
        setProblem(error instanceof ApiError ? t('api.serverError') : t('auth.unreachable'))
      }
      setChecking(false)
    }
  }

  function change(value: string) {
    // The field stays editable while a code is checked (Android would close the keyboard), but
    // ignores typing until the answer is in.
    if (checking) return
    // A pasted "123 456" or "123-456" is still the code.
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (problem && digits.length > 0) setProblem(null)
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  async function resend() {
    if (sending || wait > 0) return
    setProblem(null)
    setNote(null)
    const result = await send(sent.email)
    if (typeof result === 'string') {
      setProblem(result)
      return
    }
    setBurned(false)
    setCode('')
    setNote(t('auth.code.resent'))
    // The countdown's clock stopped at 0: restart it from now for the new wait.
    setNow(Date.now())
    onResent(result)
    input.current?.focus()
  }

  return (
    <View style={styles.step}>
      <BackLink onPress={onBack} />
      <Text accessibilityRole="header" style={styles.heading}>
        {t('auth.code.title')}
      </Text>
      <Text style={styles.about}>
        {t('auth.code.about', { email: sent.email, minutes: sent.expiresInMinutes })}
      </Text>
      <TextInput
        ref={input}
        value={code}
        onChangeText={change}
        editable={!burned}
        autoFocus
        keyboardType="number-pad"
        autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'off'}
        textContentType="oneTimeCode"
        returnKeyType="done"
        placeholder={'0'.repeat(CODE_LENGTH)}
        placeholderTextColor={color.inkMuted}
        accessibilityLabel={t('auth.code.label')}
        accessibilityState={{ busy: checking, disabled: checking || burned }}
        style={[styles.input, styles.code, problem !== null && styles.inputProblem]}
      />
      {checking ? (
        <Text accessibilityLiveRegion="polite" style={styles.about}>
          {t('auth.code.checking')}
        </Text>
      ) : null}
      {problem ? (
        <Text accessibilityLiveRegion="polite" style={styles.problem}>
          {problem}
        </Text>
      ) : null}
      {note && !problem ? (
        <Text accessibilityLiveRegion="polite" style={styles.about}>
          {note}
        </Text>
      ) : null}
      <Text style={styles.small}>{t('auth.code.spam')}</Text>
      <ActionButton
        label={wait > 0 ? t('auth.code.resendIn', { seconds: wait }) : t('auth.code.resend')}
        variant={burned ? 'primary' : 'secondary'}
        busy={sending}
        disabled={wait > 0 || checking}
        onPress={() => void resend()}
      />
      <ActionButton
        label={t('auth.code.otherEmail')}
        variant="secondary"
        disabled={checking}
        onPress={onBack}
      />
    </View>
  )
}

function BackLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('auth.back')}
      onPress={onPress}
      hitSlop={space.sm}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Text style={styles.backText}>{`‹ ${t('auth.back')}`}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  step: { gap: space.md },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...type.label, color: color.accent },
  pressed: { opacity: 0.7 },
  heading: { ...type.heading, color: color.ink },
  about: { ...type.bodySmall, color: color.inkSoft },
  small: { ...type.caption, color: color.inkMuted },
  input: {
    ...type.body,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
    color: color.ink,
  },
  inputProblem: { borderColor: color.warn },
  code: { ...type.heading, letterSpacing: 8, textAlign: 'center' },
  problem: { ...type.bodySmall, color: color.warn },
})
