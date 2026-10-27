import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/client'
import { Button } from '@/components/ui'
import { color, radius, space, type } from '@/theme'

/** A screen's data is on its way. */
export function LoadingState() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={color.inkMuted} size="large" />
    </View>
  )
}

/**
 * A screen's data couldn't be loaded, with a way to try again. The message says whether the server
 * answered with an error or was never reached (see `unwrap` in src/api/client.ts).
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <View style={styles.centre}>
      <Text style={styles.title}>{t('states.loadFailed')}</Text>
      <Text style={styles.about}>
        {error instanceof ApiError ? t('api.serverError') : t('api.unreachable')}
      </Text>
      <View style={styles.action}>
        <Button label={t('api.retry')} onPress={onRetry} />
      </View>
    </View>
  )
}

/** Nothing to show, and why: "No classes today", with an optional action below. */
export function EmptyState({
  title,
  about,
  children,
}: {
  title: string
  about?: string
  children?: ReactNode
}) {
  return (
    <View style={styles.centre}>
      <Text style={styles.title}>{title}</Text>
      {about ? <Text style={styles.about}>{about}</Text> : null}
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  )
}

/** A small rounded label: "Today", "Now". `accent` outlines it in the accent colour. */
export function Pill({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.pill, accent && styles.pillAccent]}>
      <Text style={[styles.pillText, accent && styles.pillTextAccent]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  title: { ...type.subtitle, color: color.ink, textAlign: 'center' },
  about: { ...type.bodySmall, color: color.inkMuted, textAlign: 'center' },
  action: { marginTop: space.md, alignSelf: 'stretch', alignItems: 'center' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunken,
  },
  pillAccent: { borderColor: color.accent },
  pillText: { ...type.caption, color: color.inkSoft },
  pillTextAccent: { color: color.accent },
})
