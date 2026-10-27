import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { createAccount } from '@/api/client'
import { signIn, useSession } from '@/auth'
import { Button, Muted, Screen } from '@/components/ui'
import { color, space } from '@/theme'

type Problem = string | null

/** Welcome: what the app does and one button, Microsoft sign-in with a UPT account. */
export default function SignInScreen() {
  const { t } = useTranslation()
  const { notice } = useSession()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)

  async function onSignIn() {
    setBusy(true)
    setProblem(null)
    try {
      await signIn(createAccount)
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 120) : String(error)
      console.warn('[auth] sign-in failed:', reason)
      setProblem(reason)
    } finally {
      setBusy(false)
    }
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
        {problem ? <Text style={styles.notice}>{`${t('auth.failed')} (${problem})`}</Text> : null}
        <Button
          label={busy ? t('auth.signingIn') : t('auth.signIn')}
          onPress={() => void onSignIn()}
          busy={busy}
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
  notice: { color: color.ink, fontSize: 15 },
  small: { fontSize: 13, textAlign: 'center' },
})
