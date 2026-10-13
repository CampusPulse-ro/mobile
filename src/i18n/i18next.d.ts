import 'i18next'

import type en from './en.json'

// Typed keys: t('today.title') is checked against en.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
