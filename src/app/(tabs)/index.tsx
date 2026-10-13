import { useTranslation } from 'react-i18next'

import { Placeholder } from '@/components/ui'

export default function TodayScreen() {
  const { t } = useTranslation()
  return <Placeholder title={t('today.title')} about={t('today.about')} />
}
