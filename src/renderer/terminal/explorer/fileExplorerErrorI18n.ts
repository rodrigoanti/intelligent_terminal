import type { FileExplorerErrorCode } from '@shared/fileExplorerErrorCodes'
import type { TFunction } from 'i18next'

export function fileExplorerErrorMessage(
  t: TFunction,
  error?: string,
  code?: FileExplorerErrorCode,
  extra?: Record<string, string | number>,
): string {
  if (code) {
    const key = `fileExplorer.errors.${code}` as const
    const translated = t(key, { defaultValue: '', ...extra })
    if (translated && translated !== key) return translated
  }
  return error ?? t('fileExplorer.errors.UNKNOWN')
}
