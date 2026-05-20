import type { ChatMessage } from './types'
import { readSSEStream } from './sseStream'

export interface AnthropicOptions {
  apiKey: string
  model: string
  onToken?: (text: string) => void
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
  /** Activa extended thinking de Anthropic (solo modelos que lo soportan). */
  think?: boolean
}

interface AnthropicDelta {
  type: string
  text?: string
  thinking?: string
}

interface AnthropicEvent {
  type: string
  delta?: AnthropicDelta
}

export async function chatAnthropic(
  messages: ChatMessage[],
  options: AnthropicOptions,
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: 8096,
    messages: chatMsgs,
    stream: true,
  }

  if (systemMsg) body.system = systemMsg.content
  if (options.think) body.thinking = { type: 'enabled', budget_tokens: 8000 }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('No body in Anthropic response')

  let full = ''

  await readSSEStream(res.body, data => {
    if (data === '[DONE]') return
    try {
      const event = JSON.parse(data) as AnthropicEvent
      if (event.type !== 'content_block_delta') return
      const delta = event.delta
      if (delta?.type === 'thinking_delta' && delta.thinking) {
        options.onThinkingToken?.(delta.thinking)
      } else if (delta?.type === 'text_delta' && delta.text) {
        full += delta.text
        options.onToken?.(delta.text)
      }
    } catch { /* JSON incompleto o línea no relevante */ }
  })

  return full
}
