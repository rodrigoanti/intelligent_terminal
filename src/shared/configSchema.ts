export interface AppConfig {
  ollamaBaseURL: string
  defaultModel: string
  maxContextLines: number
  themeId: string
  fontSize: number
}

export const CONFIG_DEFAULTS: AppConfig = {
  ollamaBaseURL: 'http://127.0.0.1:11434',
  defaultModel: 'llama3.2',
  maxContextLines: 200,
  themeId: 'midnight',
  fontSize: 13,
}

export function mergeWithDefaults(partial: Partial<AppConfig>): AppConfig {
  return { ...CONFIG_DEFAULTS, ...partial }
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = []
  try {
    const url = new URL(config.ollamaBaseURL)
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push('ollamaBaseURL debe usar protocolo http o https')
    }
  } catch {
    errors.push('ollamaBaseURL no es una URL válida')
  }
  if (config.maxContextLines < 10 || config.maxContextLines > 2000) {
    errors.push('maxContextLines debe estar entre 10 y 2000')
  }
  if (config.fontSize < 9 || config.fontSize > 24) {
    errors.push('fontSize debe estar entre 9 y 24')
  }
  return errors
}
