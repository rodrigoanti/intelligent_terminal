/** Respuesta mínima de GET /api/tags de Ollama */
interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

/**
 * Lista nombres de modelos locales reportados por Ollama (ej. `llama3.2:latest`).
 * @param baseURL URL base sin barra final (ej. http://127.0.0.1:11434)
 */
export async function fetchOllamaModelNames(baseURL: string): Promise<string[]> {
  const base = baseURL.replace(/\/$/, '')
  const url = `${base}/api/tags`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t ? `${res.status}: ${t.slice(0, 120)}` : `HTTP ${res.status}`)
  }
  const json = (await res.json()) as OllamaTagsResponse
  const models = json.models ?? []
  const names = models
    .map(m => (typeof m.name === 'string' ? m.name : m.model) ?? '')
    .filter((n): n is string => Boolean(n && n.trim()))
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
