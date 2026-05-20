import type { ChatMessage } from './types'
import { readSSEStream } from './sseStream'
import type { AgentTurnResult, ToolResult } from './agentTypes'
import type { ToolDefinition } from './toolDefinitions'
import { toAnthropicTools } from './toolDefinitions'

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
  partial_json?: string
}

interface AnthropicEvent {
  type: string
  index?: number
  delta?: AnthropicDelta
  content_block?: { type: string; id?: string; name?: string }
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': options.apiKey,
    'anthropic-version': '2023-06-01',
    // Requerido por Anthropic para requests CORS directas desde el navegador.
    'anthropic-dangerous-direct-browser-access': 'true',
  }

  if (options.think) {
    body.thinking = { type: 'enabled', budget_tokens: 8000 }
    // Claude 4.x y modelos con thinking extendido requieren este header beta.
    headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14'
  }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (err) {
    // Log completo para diagnóstico — visible en DevTools del renderer.
    console.error('[Anthropic] fetch falló:', err)
    throw err
  }

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

// ── Mensajes nativos de Anthropic con soporte de tool use ──────────────────

type AnthropicTextBlock = { type: 'text'; text: string }
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string }

type AnthropicAssistantContent = AnthropicTextBlock | AnthropicToolUseBlock
type AnthropicUserContent = AnthropicTextBlock | AnthropicToolResultBlock

interface AnthropicNativeMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicAssistantContent[] | AnthropicUserContent[]
}

/** Convierte el array inicial de ChatMessage al formato nativo de Anthropic (sin mensajes system). */
export function chatMessagesToAnthropicNative(messages: ChatMessage[]): AnthropicNativeMessage[] {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

/** Añade los resultados de herramientas como mensaje user en formato nativo. */
export function appendAnthropicToolResults(
  messages: AnthropicNativeMessage[],
  assistantContent: AnthropicAssistantContent[],
  results: ToolResult[],
): AnthropicNativeMessage[] {
  const toolResultBlocks: AnthropicToolResultBlock[] = results.map(r => ({
    type: 'tool_result',
    tool_use_id: r.toolCallId,
    content: r.content,
  }))

  return [
    ...messages,
    { role: 'assistant', content: assistantContent },
    { role: 'user', content: toolResultBlocks },
  ]
}

/**
 * Turno del agente con tool use nativo de Anthropic (streaming de texto + recopilación de tool calls).
 * Devuelve el texto generado y los tool calls pendientes.
 */
export async function chatAnthropicAgentTurn(
  systemPrompt: string,
  messages: AnthropicNativeMessage[],
  tools: ToolDefinition[],
  options: AnthropicOptions,
  onToken?: (text: string) => void,
): Promise<{ result: AgentTurnResult; rawContent: AnthropicAssistantContent[] }> {
  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
    tools: toAnthropicTools(tools),
    stream: true,
  }

  const agentHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': options.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (options.think) {
    body.thinking = { type: 'enabled', budget_tokens: 8000 }
    agentHeaders['anthropic-beta'] = 'interleaved-thinking-2025-05-14'
  }

  let agentRes: Response
  try {
    agentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (err) {
    console.error('[Anthropic agent] fetch falló:', err)
    throw err
  }

  const res = agentRes

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('No body in Anthropic response')

  let text = ''
  // Para cada bloque: { type, id?, name?, jsonAcc? }
  const blocks: Array<{ type: string; id?: string; name?: string; jsonAcc?: string }> = []

  await readSSEStream(res.body, data => {
    if (data === '[DONE]') return
    try {
      const event = JSON.parse(data) as AnthropicEvent
      if (event.type === 'content_block_start') {
        const blk = event.content_block
        if (!blk) return
        blocks[event.index ?? blocks.length] = {
          type: blk.type,
          id: blk.id,
          name: blk.name,
          jsonAcc: blk.type === 'tool_use' ? '' : undefined,
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta
        const idx = event.index ?? 0
        const blk = blocks[idx]
        if (!delta || !blk) return
        if (delta.type === 'text_delta' && delta.text) {
          text += delta.text
          onToken?.(delta.text)
        } else if (delta.type === 'input_json_delta' && delta.partial_json !== undefined) {
          if (blk.jsonAcc !== undefined) blk.jsonAcc += delta.partial_json
        }
      }
    } catch { /* línea no relevante */ }
  })

  const rawContent: AnthropicAssistantContent[] = []
  const toolCalls: import('./agentTypes').ToolCall[] = []

  for (const blk of blocks) {
    if (!blk) continue
    if (blk.type === 'text' && text) {
      rawContent.push({ type: 'text', text })
    } else if (blk.type === 'tool_use' && blk.id && blk.name) {
      let input: Record<string, unknown> = {}
      try { input = JSON.parse(blk.jsonAcc ?? '{}') as Record<string, unknown> } catch { /* malformed */ }
      rawContent.push({ type: 'tool_use', id: blk.id, name: blk.name, input })
      toolCalls.push({ id: blk.id, name: blk.name, input })
    }
  }

  if (text && !rawContent.some(b => b.type === 'text')) {
    rawContent.unshift({ type: 'text', text })
  }

  return { result: { text, toolCalls }, rawContent }
}
