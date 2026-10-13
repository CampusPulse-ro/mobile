/**
 * Translations. English is the default; Romanian when the student picks it on Profile.
 * The app does not follow the device language: everyone starts in English (decided
 * 2026-10-14), and the choice is saved on the device.
 *
 * Every user-facing text is a key in BOTH en.json and ro.json: a key missing from
 * ro.json is a type error (below), and `t('…')` only accepts keys that exist.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import roJson from './ro.json'

// Same shape as en.json, or this line fails to type-check.
const ro: typeof en = roJson

export const LANGUAGES = ['en', 'ro'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'

const STORAGE_KEY = 'campuspulse.language'

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

// Synchronous init (resources are bundled), so the first render already has strings.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ro: { translation: ro } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
})

/** Applies the language saved on this device, if any. Call once at startup. */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY)
    if (isLanguage(saved) && saved !== i18n.language) await i18n.changeLanguage(saved)
  } catch {
    // Storage unavailable: stay on the default.
  }
}

/** Switches the UI language and remembers it on this device. */
export async function setLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language)
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not remembered, but the switch itself worked.
  }
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export default i18n
