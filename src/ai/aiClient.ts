import type { AiProvider, AppConfig } from '@shared/configSchema'
import type { ChatMessage } from './types'
import { chatOllama } from './ollamaClient'
import { chatAnthropic } from './anthropicClient'
import { chatOpenAI } from './openaiClient'

export interface AiOptions {
  provider: AiProvider
  ollamaBaseURL: string
  anthropicApiKey: string
  openaiApiKey: string
  model: string
  onToken?: (text: string) => void
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
  think?: boolean
}

export async function chatAI(messages: ChatMessage[], options: AiOptions): Promise<string> {
  switch (options.provider) {
    case 'anthropic':
      return chatAnthropic(messages, {
        apiKey: options.anthropicApiKey,
        model: options.model,
        onToken: options.onToken,
        onThinkingToken: options.onThinkingToken,
        signal: options.signal,
        think: options.think,
      })
    case 'openai':
      return chatOpenAI(messages, {
        apiKey: options.openaiApiKey,
        model: options.model,
        onToken: options.onToken,
        onThinkingToken: options.onThinkingToken,
        signal: options.signal,
      })
    case 'ollama':
    default:
      return chatOllama(messages, {
        baseURL: options.ollamaBaseURL,
        model: options.model,
        onToken: options.onToken,
        onThinkingToken: options.onThinkingToken,
        signal: options.signal,
        think: options.think,
      })
  }
}

/** Extrae las opciones de IA a partir de la config de la app. */
export function aiOptionsFromConfig(
  config: AppConfig,
  overrides?: Partial<Pick<AiOptions, 'onToken' | 'onThinkingToken' | 'signal' | 'think'>>,
): AiOptions {
  return {
    provider: config.aiProvider,
    ollamaBaseURL: config.ollamaBaseURL,
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    model: config.defaultModel,
    think: config.thinkingMode,
    ...overrides,
  }
}
