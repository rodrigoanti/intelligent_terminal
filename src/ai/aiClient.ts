import type { AiProvider, AppConfig } from '@shared/configSchema'
import { GIT_MAX_COMMIT_MESSAGE_CHARS } from '@shared/gitSessionTypes'
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

/** Sugerencia de mensaje de commit usando el proveedor de IA configurado. */
export async function suggestGitCommitMessage(
  diffContext: string,
  options: AiOptions,
): Promise<string> {
  const trimmed = diffContext.trim().slice(0, 120_000)
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You write git commit subject lines only. Reply with exactly ONE line: a concise subject ' +
        '(prefer Conventional Commits: type(scope): description). No quotes, no markdown fences, no backticks, no multiple lines.',
    },
    {
      role: 'user',
      content:
        'Propose only the commit subject line for the following repository state and diffs:\n\n' +
        trimmed,
    },
  ]
  const raw = await chatAI(messages, { ...options, think: false })
  const cleaned = raw
    .replace(/^[`"'«»]+|[`"'«»]+$/g, '')
    .trim()
  const line = cleaned.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) ?? ''
  return line.slice(0, GIT_MAX_COMMIT_MESSAGE_CHARS)
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
