/** Política de ejecución de shell del modo agente (el modelo propone bloques RUN). */
export type AgentShellPolicy = 'off' | 'ask' | 'always'

const SPOTIFY_PLAYLIST_ID_RE = /^[a-zA-Z0-9]{22}$/

/**
 * Obtiene el ID de playlist de Spotify (22 caracteres) desde un ID crudo o desde enlaces habituales.
 * Devuelve `null` si la cadena no está vacía pero no se reconoce.
 */
export function parseSpotifyPlaylistId(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (SPOTIFY_PLAYLIST_ID_RE.test(s)) return s
  const fromUrl = s.match(
    /open\.spotify\.com\/(?:[^/]+\/)*playlist\/([a-zA-Z0-9]{22})(?:\?|#|$|\/)/i,
  )
  if (fromUrl) return fromUrl[1]
  const fromUri = s.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/i)
  if (fromUri) return fromUri[1]
  return null
}

/** Convierte enlaces reconocibles a ID de 22 caracteres; deja sin cambio entradas no vacías no reconocidas (para que falle la validación). */
export function canonicalizeMusicPlaylistIdsByMood(byMood: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(byMood)) {
    const t = (v ?? '').trim()
    if (!t) continue
    const id = parseSpotifyPlaylistId(t)
    out[k] = id ?? t
  }
  return out
}

export interface AppConfig {
  ollamaBaseURL: string
  defaultModel: string
  maxContextLines: number
  themeId: string
  fontSize: number
  /** Si true, el chat puede leer/escribir archivos bajo el cwd (modo agente). UI: cabecera del panel IA. */
  agentMode: boolean
  /**
   * Ejecución de comandos RUN del agente bajo el cwd de la sesión.
   * `off`: no se ejecuta nada; `ask`: confirmación por comando; `always`: sin preguntar. UI: cabecera del panel IA.
   */
  agentShellPolicy: AgentShellPolicy
  /**
   * Activa el modo thinking de Ollama (`think: true` en la petición).
   * Solo tiene efecto en modelos que lo soportan (qwen3, deepseek-r1, etc.).
   */
  thinkingMode: boolean
  /**
   * IDs de playlist de Spotify (22 caracteres) por clave de estado de ánimo (`musicMoods`).
   * Solo se usan entradas no vacías.
   */
  musicPlaylistIdsByMood?: Record<string, string>
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
  musicPlaylistIdsByMood: {},
}

export function mergeWithDefaults(partial: Partial<AppConfig>): AppConfig {
  const rawMoods = {
    ...CONFIG_DEFAULTS.musicPlaylistIdsByMood,
    ...(partial.musicPlaylistIdsByMood ?? {}),
  }
  const moods = canonicalizeMusicPlaylistIdsByMood(rawMoods)
  return { ...CONFIG_DEFAULTS, ...partial, musicPlaylistIdsByMood: moods }
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
  const byMood = config.musicPlaylistIdsByMood ?? {}
  for (const [k, v] of Object.entries(byMood)) {
    const t = (v ?? '').trim()
    if (!t) continue
    const id = parseSpotifyPlaylistId(t)
    if (!id) {
      errors.push(
        `musicPlaylistIdsByMood["${k}"] debe ser un ID de 22 caracteres o un enlace open.spotify.com/playlist/…`,
      )
    }
  }
  return errors
}
