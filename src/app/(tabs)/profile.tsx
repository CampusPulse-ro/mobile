import { useTranslation } from 'react-i18next'

import { CampusVirtualCard } from '@/components/CampusVirtualCard'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Muted, Placeholder } from '@/components/ui'

export default function ProfileScreen() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('profile.title')} about={t('profile.about')}>
      <CampusVirtualCard />
      <Muted>{t('profile.language')}</Muted>
      <LanguageSwitch />
    </Placeholder>
  )
}
