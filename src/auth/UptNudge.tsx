import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, radius, space, type } from '@/theme'

import { useMe } from './account'

/** A dismissed banner stays away this long, then comes back once. */
const QUIET_FOR_MS = 14 * 24 * 60 * 60_000

const storageKey = (userId: string) => `campuspulse.uptNudgeDismissedAt.${userId}`
const dismissedKey = (userId: string) => ['local', 'uptNudgeDismissed', userId] as const

/**
 * While UPT isn't linked: one quiet line on Today and Deadlines, "Link your UPT account to get your
 * deadlines automatically", with Link (to Profile, where linking is) and a close button. Closing it
 * keeps it away for two weeks on this phone; it never blocks anything.
 */
export function UptNudge() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const me = useMe()
  const userId = me.data?.id ?? ''
  // Read once per account from the phone's storage; shared by every screen that shows the banner.
  const dismissed = useQuery({
    queryKey: dismissedKey(userId),
    queryFn: async () => {
      try {
        const at = Number(await AsyncStorage.getItem(storageKey(userId)))
        return at > 0 && Date.now() - at < QUIET_FOR_MS
      } catch {
        return false
      }
    },
    enabled: userId !== '',
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (!me.data || me.data.uptLinked || dismissed.data !== false) return null

  const dismiss = () => {
    queryClient.setQueryData(dismissedKey(userId), true)
    void AsyncStorage.setItem(storageKey(userId), String(Date.now())).catch(() => undefined)
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t('nudge.text')}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('nudge.linkHint')}
          onPress={() => router.navigate('/profile')}
          hitSlop={space.xs}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.link}>{t('nudge.link')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nudge.dismiss')}
          onPress={dismiss}
          hitSlop={space.xs}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>{'×'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  text: { ...type.bodySmall, color: color.inkSoft, flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  link: { ...type.label, color: color.accent },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...type.heading, color: color.inkMuted },
  pressed: { opacity: 0.7 },
})
