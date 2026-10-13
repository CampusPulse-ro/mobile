import { useTranslation } from 'react-i18next'

import { Placeholder } from '@/components/ui'

export default function MapScreen() {
  const { t } = useTranslation()
  return <Placeholder title={t('map.title')} about={t('map.about')} />
}
