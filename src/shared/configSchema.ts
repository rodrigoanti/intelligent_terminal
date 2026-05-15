/** Política de ejecución de shell del modo agente (el modelo propone bloques RUN). */
export type AgentShellPolicy = 'off' | 'ask' | 'always'

export interface AppConfig {
  ollamaBaseURL: string
  defaultModel: string
  maxContextLines: number
  themeId: string
  fontSize: number
  /** Si true, el chat puede leer/escribir archivos bajo el cwd (modo agente). */
  agentMode: boolean
  /**
   * Ejecución real de comandos propuestos por el modelo bajo el cwd de la sesión.
   * `off`: no se ejecuta nada; `ask`: confirmación por comando; `always`: sin preguntar.
   */
  agentShellPolicy: AgentShellPolicy
  /**
   * Activa el modo thinking de Ollama (`think: true` en la petición).
   * Solo tiene efecto en modelos que lo soportan (qwen3, deepseek-r1, etc.).
   */
  thinkingMode: boolean
}

export const CONFIG_DEFAULTS: AppConfig = {
  ollamaBaseURL: 'http://127.0.0.1:11434',
  defaultModel: 'llama3.2',
  maxContextLines: 200,
  themeId: 'vscodeDark',
  fontSize: 13,
  agentMode: false,
  agentShellPolicy: 'off',
  thinkingMode: false,
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
  const pol = config.agentShellPolicy
  if (pol !== 'off' && pol !== 'ask' && pol !== 'always') {
    errors.push('agentShellPolicy debe ser off, ask o always')
  }
  return errors
}
