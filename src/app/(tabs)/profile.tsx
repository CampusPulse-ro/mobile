import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { api, ApiError, unwrap } from '@/api/client'
import { signOut } from '@/auth'
import { CampusVirtualCard } from '@/components/CampusVirtualCard'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button, Heading, Muted, Screen, Title } from '@/components/ui'
import {
  DEFAULT_REMINDER_LEAD,
  getPushPermission,
  getReminderLead,
  REMINDER_LEADS,
  registerForPush,
  sendTestNotification,
  setReminderLead,
  unregisterPush,
  type ReminderLead,
} from '@/push'
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
  const queryClient = useQueryClient()

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await registerForPush({ ask: true })
      if (result !== 'granted') setMessage(t('push.blocked'))
      // Allowing notifications is what the student asked for: reminders come with it.
      else if ((await getReminderLead()) === null) {
        queryClient.setQueryData(REMINDERS_KEY, await setReminderLead(DEFAULT_REMINDER_LEAD))
      }
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
      {on ? <ReminderLeadChoice /> : null}
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

const REMINDERS_KEY = ['me', 'reminders'] as const

/** How long before each class the API sends a reminder: Off, 5, 10, 15, 30 or 60 minutes. */
function ReminderLeadChoice() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const lead = useQuery({ queryKey: REMINDERS_KEY, queryFn: getReminderLead })
  const [saving, setSaving] = useState<ReminderLead | 'none'>('none')
  const [failed, setFailed] = useState(false)

  async function choose(value: ReminderLead) {
    if (saving !== 'none' || value === lead.data) return
    setSaving(value)
    setFailed(false)
    try {
      queryClient.setQueryData(REMINDERS_KEY, await setReminderLead(value))
    } catch {
      setFailed(true)
    } finally {
      setSaving('none')
    }
  }

  const options: ReminderLead[] = [null, ...REMINDER_LEADS]
  return (
    <View style={styles.leadBlock}>
      <Text style={styles.leadLabel}>{t('push.leadLabel')}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('push.leadLabel')}
        style={styles.leadRow}
      >
        {options.map((value) => {
          const selected = lead.data !== undefined && lead.data === value
          const label = value === null ? t('push.leadOff') : t('push.leadMinutes', { n: value })
          return (
            <Pressable
              key={String(value)}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selected,
                busy: saving === value,
                disabled: lead.isPending,
              }}
              disabled={lead.isPending}
              onPress={() => void choose(value)}
              style={[styles.leadOption, selected && styles.leadSelected]}
            >
              <Text style={[styles.leadText, selected && styles.leadTextSelected]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Muted>
        {lead.data === null || lead.data === undefined
          ? t('push.leadOffAbout')
          : t('push.leadAbout', { n: lead.data })}
      </Muted>
      {failed || lead.isError ? <Text style={styles.message}>{t('push.failed')}</Text> : null}
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
  leadBlock: { gap: space.sm },
  leadLabel: { color: color.ink, fontSize: 15, fontWeight: '600' },
  leadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  leadOption: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.page,
  },
  leadSelected: { borderColor: color.accent },
  leadText: { color: color.inkSoft, fontSize: 15 },
  leadTextSelected: { color: color.ink, fontWeight: '600' },
  danger: { marginTop: space.xl, gap: space.sm },
})
