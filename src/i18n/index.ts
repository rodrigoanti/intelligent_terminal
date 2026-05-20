import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import es from './locales/es'

export async function initI18n(language = 'en'): Promise<void> {
  await i18next.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'app',
    resources: {
      en: { app: en },
      es: { app: es },
    },
    interpolation: {
      escapeValue: false,
    },
  })
}

export { i18next }
