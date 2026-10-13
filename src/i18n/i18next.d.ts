import 'i18next'

import type en from './en.json'

// Typed keys: t('today.title') is checked against en.json. strictKeyChecks keeps that true
// when a default text is passed too (i18next otherwise accepts any key with t('x', 'Fallback')).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
    strictKeyChecks: true
  }
}
