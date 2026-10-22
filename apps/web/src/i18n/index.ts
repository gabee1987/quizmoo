import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import hu from './hu.json'
import en from './en.json'

export const languages = ['hu', 'en'] as const
export type Language = (typeof languages)[number]

const STORAGE_KEY = 'quizmoo.lang'

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'hu' || stored === 'en') return stored
  } catch {
    // storage may be unavailable in private mode
  }
  return navigator.language.toLowerCase().startsWith('hu') ? 'hu' : 'en'
}

export function setLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore
  }
  void i18next.changeLanguage(lang)
  document.documentElement.lang = lang
}

void i18next.use(initReactI18next).init({
  resources: { hu: { translation: hu }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'hu',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18next.language

export default i18next
