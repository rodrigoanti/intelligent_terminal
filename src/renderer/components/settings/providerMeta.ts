import type { AiProvider } from '@shared/configSchema'

export interface ModelOption {
  id: string
  label: string
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  ollama: 'Ollama (local)',
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT / o-series)',
}

export const ANTHROPIC_MODELS: ModelOption[] = [
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (rápido)' },
  { id: 'claude-opus-4', label: 'Claude Opus 4' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
]

export const OPENAI_MODELS: ModelOption[] = [
  { id: 'o3', label: 'o3 (razonamiento)' },
  { id: 'o4-mini', label: 'o4-mini (razonamiento rápido)' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (rápido)' },
  { id: 'o3-mini', label: 'o3-mini' },
]
