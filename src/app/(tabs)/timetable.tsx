import { useTranslation } from 'react-i18next'

import { Placeholder } from '@/components/ui'

export default function TimetableScreen() {
  const { t } = useTranslation()
  return <Placeholder title={t('timetable.title')} about={t('timetable.about')} />
}
