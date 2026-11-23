import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { ApiError, problemType } from '@/api/client'
import { signInWithUpt, useSession } from '@/auth'
import { EmailSignIn } from '@/auth/EmailSignIn'
import { Button, Muted, Screen } from '@/components/ui'
import { color, space } from '@/theme'

/**
 * Welcome: what the app does, "Continue with UPT" (the main way: deadlines and Campus Virtual come
 * with it) and, below it, "Or use your email" (an email and a one-time code).
 */
export default function SignInScreen() {
  const { t } = useTranslation()
  const { notice } = useSession()
  const [withEmail, setWithEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function continueWithUpt() {
    setBusy(true)
    setProblem(null)
    try {
      await signInWithUpt()
      // Signed in (the root layout moves on from here), or the student closed Microsoft's page.
    } catch (error) {
      const kind = problemType(error)
      console.warn('[auth] UPT sign-in failed:', kind ?? (error instanceof Error ? error.name : ''))
      setProblem(
        kind === 'microsoft-token-invalid'
          ? t('auth.uptRefused')
          : error instanceof ApiError && error.status === 503
            ? t('auth.uptUnavailable')
            : error instanceof ApiError
              ? t('auth.failed')
              : t('auth.unreachable'),
      )
    } finally {
      setBusy(false)
    }
  }

  if (withEmail) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <EmailSignIn onCancel={() => setWithEmail(false)} />
        </ScrollView>
      </Screen>
    )
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.brand}>{t('auth.brand')}</Text>
        <Text style={styles.title}>{t('auth.welcome')}</Text>
        <Muted>{t('auth.about')}</Muted>
      </View>

      <View style={styles.bottom}>
        {notice ? <Text style={styles.notice}>{t(`auth.notice.${notice}`)}</Text> : null}
        {problem ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {problem}
          </Text>
        ) : null}
        <View style={styles.primary}>
          <Button
            label={busy ? t('auth.signingIn') : t('auth.continueWithUpt')}
            onPress={() => void continueWithUpt()}
            busy={busy}
          />
          <Muted style={styles.why}>{t('auth.uptWhy')}</Muted>
        </View>
        <Button
          label={t('auth.useEmail')}
          variant="secondary"
          busy={false}
          onPress={() => {
            setProblem(null)
            setWithEmail(true)
          }}
        />
        <Muted style={styles.small}>{t('auth.unofficial')}</Muted>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.xl },
  top: { paddingTop: space.xl * 2, gap: space.md },
  brand: { color: color.accent, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  title: { color: color.ink, fontSize: 32, fontWeight: '700', lineHeight: 38 },
  bottom: { gap: space.md },
  primary: { gap: space.sm },
  why: { fontSize: 13, textAlign: 'center' },
  notice: { color: color.ink, fontSize: 15 },
  small: { fontSize: 13, textAlign: 'center' },
  form: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl },
})
