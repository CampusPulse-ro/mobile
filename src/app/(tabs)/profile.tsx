import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { api, unwrap } from '@/api/client'
import { signOut } from '@/auth'
import { CampusVirtualCard } from '@/components/CampusVirtualCard'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button, Heading, Muted, Placeholder } from '@/components/ui'
import { color, radius, space } from '@/theme'

export default function ProfileScreen() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('profile.title')} about={t('profile.about')}>
      <AccountCard />
      <CampusVirtualCard />
      <Muted>{t('profile.language')}</Muted>
      <LanguageSwitch />
    </Placeholder>
  )
}

/** Who is signed in (`GET /me`), and Sign out. */
function AccountCard() {
  const { t } = useTranslation()
  const me = useQuery({ queryKey: ['me', 'account'], queryFn: async () => unwrap(await api.GET('/me')) })
  return (
    <View style={styles.card}>
      <Heading>{t('auth.account')}</Heading>
      {me.data ? (
        <View>
          <Text style={styles.name}>{me.data.displayName}</Text>
          <Muted>{me.data.email}</Muted>
        </View>
      ) : null}
      <Button label={t('auth.signOut')} variant="secondary" onPress={() => void signOut()} />
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
  name: { color: color.ink, fontSize: 16, fontWeight: '600' },
})
