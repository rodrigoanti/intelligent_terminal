import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchOllamaModelNames } from '@ai/ollamaModels'

interface UseOllamaModelsResult {
  /** Lista de nombres de modelos disponibles en Ollama. */
  models: string[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Obtiene la lista de modelos instalados en Ollama.
 * Solo hace fetch cuando `enabled` es true.
 */
export function useOllamaModels(baseURL: string, enabled: boolean): UseOllamaModelsResult {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debouncedURL, setDebouncedURL] = useState(baseURL.trim())

  useEffect(() => {
    const t = setTimeout(() => setDebouncedURL(baseURL.trim()), 400)
    return () => clearTimeout(t)
  }, [baseURL])

  const fetch_ = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setModels([])
    try {
      const names = await fetchOllamaModelNames(debouncedURL)
      setModels(names)
    } catch (e) {
      setModels([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [debouncedURL])

  useEffect(() => {
    if (enabled) void fetch_()
  }, [fetch_, enabled])

  return { models, loading, error, reload: () => void fetch_() }
}

/**
 * Combina la lista de modelos de Ollama con el modelo actualmente configurado,
 * para que siempre aparezca en el selector aunque no esté instalado.
 */
export function useOllamaSelectOptions(models: string[], currentModel: string): string[] {
  return useMemo(() => {
    const m = currentModel.trim()
    const set = new Set(models)
    if (m) set.add(m)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [models, currentModel])
}
