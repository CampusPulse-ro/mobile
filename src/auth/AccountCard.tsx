import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'

import { ApiError, problemType } from '@/api/client'
import type { useCampusVirtual } from '@/campusVirtual/useCampusVirtual'
import { Button, Heading, Muted } from '@/components/ui'
import { color, radius, space, type } from '@/theme'

import { uptIdentity, useLinkUpt, useMe, useUnlinkUpt } from './account'

type Message = { ok: boolean; text: string }

/**
 * Profile's Account section: who is signed in, the two ways in (the email, UPT) with Link and
 * Unlink, and Sign out. Right after UPT is linked, it offers to connect Campus Virtual (the same
 * connection as the Campus Virtual section below it, passed in).
 */
export function AccountCard({
  campusVirtual,
  onSignOut,
}: {
  campusVirtual: ReturnType<typeof useCampusVirtual>
  onSignOut: () => void
}) {
  const { t } = useTranslation()
  const me = useMe()
  const link = useLinkUpt()
  const unlink = useUnlinkUpt()
  const [message, setMessage] = useState<Message | null>(null)
  const [justLinked, setJustLinked] = useState(false)
  const upt = uptIdentity(me.data)
  const email = me.data?.email ?? null

  const linkFailure = (error: unknown): string => {
    const kind = problemType(error)
    if (kind === 'identity-in-use') return t('account.identityInUse')
    if (kind === 'already-linked') return t('account.alreadyLinked')
    if (kind === 'microsoft-token-invalid') return t('account.uptRefused')
    if (error instanceof ApiError && error.status === 503) return t('account.uptUnavailable')
    if (error instanceof ApiError && error.status === 429) return t('account.wait')
    return error instanceof ApiError ? t('api.serverError') : t('api.unreachable')
  }

  const linkNow = () => {
    setMessage(null)
    link.mutate(undefined, {
      onSuccess: (linked) => {
        if (!linked) return // closed Microsoft's page
        setJustLinked(true)
        setMessage({ ok: true, text: t('account.linked') })
      },
      onError: (error) => setMessage({ ok: false, text: linkFailure(error) }),
    })
  }

  const unlinkNow = () => {
    setMessage(null)
    setJustLinked(false)
    unlink.mutate(undefined, {
      onSuccess: () => setMessage({ ok: true, text: t('account.unlinked') }),
      onError: (error) =>
        setMessage({
          ok: false,
          text:
            problemType(error) === 'last-sign-in-method'
              ? t('account.lastMethod')
              : error instanceof ApiError && error.status === 429
                ? t('account.wait')
                : error instanceof ApiError
                  ? t('api.serverError')
                  : t('api.unreachable'),
        }),
    })
  }

  const confirmUnlink = () => {
    Alert.alert(
      t('account.unlinkTitle'),
      t('account.unlinkConfirm', { email: email ?? '' }),
      [
        { text: t('account.cancel'), style: 'cancel', isPreferred: true },
        { text: t('account.unlink'), style: 'destructive', onPress: unlinkNow },
      ],
      { cancelable: true },
    )
  }

  const offerCampusVirtual =
    justLinked &&
    upt !== null &&
    (campusVirtual.state.status === 'disconnected' || campusVirtual.state.status === 'connecting')

  return (
    <View style={styles.card}>
      <Heading>{t('auth.account')}</Heading>

      {me.isPending ? (
        <View style={styles.row}>
          <ActivityIndicator color={color.inkMuted} />
          <Muted>{t('account.loading')}</Muted>
        </View>
      ) : null}
      {me.isError && !me.data ? (
        <View style={styles.method}>
          <Text style={styles.problem}>{t('account.loadFailed')}</Text>
          <Button label={t('api.retry')} variant="secondary" onPress={() => void me.refetch()} />
        </View>
      ) : null}

      {me.data ? (
        <>
          <View>
            <Text style={styles.name}>{me.data.displayName}</Text>
            {email ? <Muted>{email}</Muted> : null}
          </View>

          <View style={styles.method}>
            <Text style={styles.methodTitle}>{t('account.emailMethod')}</Text>
            <Muted>{email ? t('account.emailAbout', { email }) : t('account.noEmail')}</Muted>
          </View>

          <View style={styles.method}>
            <Text style={styles.methodTitle}>{t('account.uptMethod')}</Text>
            {upt ? (
              <>
                <Muted>
                  {upt.email
                    ? t('account.uptLinkedAs', { email: upt.email })
                    : t('account.uptLinked')}
                </Muted>
                {email ? (
                  <Button
                    label={t('account.unlink')}
                    variant="secondary"
                    busy={unlink.isPending}
                    onPress={confirmUnlink}
                  />
                ) : (
                  <Muted>{t('account.uptOnly')}</Muted>
                )}
              </>
            ) : (
              <>
                <Muted>{t('account.uptNotLinked')}</Muted>
                <Button label={t('account.link')} busy={link.isPending} onPress={linkNow} />
              </>
            )}
          </View>
        </>
      ) : null}

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.message, message.ok ? styles.ok : styles.problem]}
        >
          {message.text}
        </Text>
      ) : null}

      {offerCampusVirtual ? (
        <View style={styles.offer}>
          <Text style={styles.offerText}>{t('account.offerCampusVirtual')}</Text>
          <Button
            label={
              campusVirtual.state.status === 'connecting'
                ? t('campusVirtual.connecting')
                : t('campusVirtual.connect')
            }
            busy={campusVirtual.state.status === 'connecting'}
            onPress={() => void campusVirtual.connect()}
          />
        </View>
      ) : null}

      <Button label={t('auth.signOut')} variant="secondary" onPress={onSignOut} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.raised,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { color: color.ink, fontSize: 16, fontWeight: '600' },
  method: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  methodTitle: { ...type.label, color: color.ink },
  message: { ...type.bodySmall },
  ok: { color: color.success },
  problem: { ...type.bodySmall, color: color.warn },
  offer: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.page,
  },
  offerText: { ...type.bodySmall, color: color.ink },
})
