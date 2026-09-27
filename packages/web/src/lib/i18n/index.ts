import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enTranslation from '../../../public/locales/en/translation.json'

const defaultLanguage = 'en'

const resources = {
  en: {
    translation: enTranslation,
  },
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLanguage,
    lng: defaultLanguage,
    resources,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    returnNull: false,
  })

function changeLanguage({ language }: { language: string }): Promise<unknown> {
  return i18n.changeLanguage(language)
}

function getLanguage(): string {
  return i18n.language || defaultLanguage
}

export const i18nUtils = {
  changeLanguage,
  getLanguage,
}

export { i18n }
export default i18n
