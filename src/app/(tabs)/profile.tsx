import { useTranslation } from 'react-i18next'

import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Muted, Placeholder } from '@/components/ui'

export default function ProfileScreen() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('profile.title')} about={t('profile.about')}>
      <Muted>{t('profile.language')}</Muted>
      <LanguageSwitch />
    </Placeholder>
  )
}
