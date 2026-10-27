import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { api, ApiError, unwrap } from '@/api/client'
import { signOut } from '@/auth'
import { CampusVirtualCard } from '@/components/CampusVirtualCard'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button, Heading, Muted, Screen, Title } from '@/components/ui'
import { getPushPermission, registerForPush, sendTestNotification, unregisterPush } from '@/push'
import { color, radius, space } from '@/theme'

export default function ProfileScreen() {
  const { t } = useTranslation()
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>{t('profile.title')}</Title>
        <AccountCard />
        <RemindersCard />
        <CampusVirtualCard />
        <Muted>{t('profile.language')}</Muted>
        <LanguageSwitch />
        <DeleteAccount />
      </ScrollView>
    </Screen>
  )
}

/** Signing out forgets this phone for push first, while the token still works. */
async function signOutHere() {
  await unregisterPush()
  await signOut()
}

/** Who is signed in (`GET /me`), and Sign out. */
function AccountCard() {
  const { t } = useTranslation()
  const me = useQuery({
    queryKey: ['me', 'account'],
    queryFn: async () => unwrap(await api.GET('/me')),
  })
  return (
    <View style={styles.card}>
      <Heading>{t('auth.account')}</Heading>
      {me.data ? (
        <View>
          <Text style={styles.name}>{me.data.displayName}</Text>
          <Muted>{me.data.email}</Muted>
        </View>
      ) : null}
      <Button label={t('auth.signOut')} variant="secondary" onPress={() => void signOutHere()} />
    </View>
  )
}

/** Class reminders: allow notifications for this phone, and a test send through our server. */
function RemindersCard() {
  const { t } = useTranslation()
  const permission = useQuery({ queryKey: ['push', 'permission'], queryFn: getPushPermission })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const on = permission.data === 'granted'

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await registerForPush({ ask: true })
      if (result !== 'granted') setMessage(t('push.blocked'))
      await permission.refetch()
    } catch {
      setMessage(t('push.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    try {
      await registerForPush({ ask: false })
      const sent = await sendTestNotification()
      setMessage(sent > 0 ? t('push.testSent') : t('push.noDevices'))
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 429 ? t('push.wait') : t('push.failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Heading>{t('push.title')}</Heading>
      <Muted>{on ? t('push.on') : t('push.about')}</Muted>
      {on ? (
        <Button
          label={t('push.test')}
          variant="secondary"
          busy={busy}
          onPress={() => void test()}
        />
      ) : (
        <Button label={t('push.turnOn')} busy={busy} onPress={() => void turnOn()} />
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  )
}

/** `DELETE /me` after a confirmation whose default is Cancel; then signed out with the reason. */
function DeleteAccount() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      const result = await api.DELETE('/me')
      if (!result.response.ok) throw new ApiError(result.response.status, result.error)
      // DELETE /me removed every device with the account; just drop the tokens.
      await signOut('accountGone')
    } catch {
      setBusy(false)
      Alert.alert(t('deleteAccount.failedTitle'), t('deleteAccount.failed'))
    }
  }

  function confirm() {
    Alert.alert(t('deleteAccount.title'), t('deleteAccount.confirm'), [
      { text: t('deleteAccount.cancel'), style: 'cancel', isPreferred: true },
      { text: t('deleteAccount.delete'), style: 'destructive', onPress: () => void remove() },
    ])
  }

  return (
    <View style={styles.danger}>
      <Muted>{t('deleteAccount.about')}</Muted>
      <Button label={t('deleteAccount.button')} variant="secondary" busy={busy} onPress={confirm} />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  card: {
    backgroundColor: color.raised,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  name: { color: color.ink, fontSize: 16, fontWeight: '600' },
  message: { color: color.ink, fontSize: 15 },
  danger: { marginTop: space.xl, gap: space.sm },
})
