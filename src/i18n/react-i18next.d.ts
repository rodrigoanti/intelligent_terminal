import type en from './locales/en'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'app'
    resources: { app: typeof en }
  }
}
