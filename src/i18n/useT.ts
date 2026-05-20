import { useTranslation } from 'react-i18next'

/**
 * Hook tipado de traducción. Todos los componentes deben importar este hook
 * en lugar de `useTranslation` directamente, para centralizar la dependencia
 * en la librería i18n y simplificar una futura migración.
 */
export function useT() {
  return useTranslation('app')
}
