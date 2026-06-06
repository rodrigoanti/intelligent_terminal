/** Machine-readable git errors from main process; map to i18n in the renderer. */
export const GIT_ERROR_CODES = {
  CWD_INVALID: 'CWD_INVALID',
  NOT_A_REPO: 'NOT_A_REPO',
  INVALID_COMMIT_MESSAGE: 'INVALID_COMMIT_MESSAGE',
  TIMEOUT: 'TIMEOUT',
} as const

export type GitErrorCode = (typeof GIT_ERROR_CODES)[keyof typeof GIT_ERROR_CODES]
