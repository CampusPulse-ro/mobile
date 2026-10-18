import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Button, Placeholder } from '@/components/ui'

/**
 * Shown for a link that matches no screen. It never prints the link: a mistyped or unexpected
 * `campuspulse://` URL could carry a credential (see src/app/+native-intent.tsx).
 */
export default function NotFoundScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <Placeholder title={t('notFound.title')} about={t('notFound.about')}>
      <Button label={t('notFound.home')} onPress={() => router.replace('/')} />
    </Placeholder>
  )
}
