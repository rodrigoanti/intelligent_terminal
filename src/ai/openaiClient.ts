import type { ChatMessage } from './types'
import { readSSEStream } from './sseStream'
import type { AgentTurnResult, ToolResult } from './agentTypes'
import type { ToolDefinition } from './toolDefinitions'
import { toOpenAITools } from './toolDefinitions'

export interface OpenAIOptions {
  apiKey: string
  model: string
  onToken?: (text: string) => void
  /** Para o3/o4-mini: tokens de razonamiento internos. */
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
}

interface OpenAIDelta {
  content?: string
  reasoning_content?: string
}

interface OpenAIChunk {
  choices?: Array<{ delta?: OpenAIDelta }>
}

export async function chatOpenAI(
  messages: ChatMessage[],
  options: OpenAIOptions,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ model: options.model, messages, stream: true }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('No body in OpenAI response')

  let full = ''

  await readSSEStream(res.body, data => {
    if (data === '[DONE]') return
    try {
      const chunk = JSON.parse(data) as OpenAIChunk
      const delta = chunk.choices?.[0]?.delta
      if (delta?.reasoning_content) {
        options.onThinkingToken?.(delta.reasoning_content)
      }
      if (delta?.content) {
        full += delta.content
        options.onToken?.(delta.content)
      }
    } catch { /* JSON incompleto */ }
  })

  return full
}

// ── Mensajes nativos de OpenAI con soporte de function calling ─────────────

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type OpenAINativeMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface OpenAIAgentChunk {
  choices?: Array<{
    delta?: {
      content?: string
      reasoning_content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
}

/** Convierte el array inicial de ChatMessage al formato nativo de OpenAI. */
export function chatMessagesToOpenAINative(messages: ChatMessage[]): OpenAINativeMessage[] {
  return messages.map(m => ({ role: m.role, content: m.content })) as OpenAINativeMessage[]
}

/** Añade los resultados de herramientas al historial de mensajes OpenAI. */
export function appendOpenAIToolResults(
  messages: OpenAINativeMessage[],
  assistantToolCalls: OpenAIToolCall[],
  assistantText: string | null,
  results: ToolResult[],
): OpenAINativeMessage[] {
  const toolMessages: OpenAINativeMessage[] = results.map(r => ({
    role: 'tool' as const,
    tool_call_id: r.toolCallId,
    content: r.content,
  }))

  return [
    ...messages,
    {
      role: 'assistant' as const,
      content: assistantText || null,
      ...(assistantToolCalls.length > 0 ? { tool_calls: assistantToolCalls } : {}),
    },
    ...toolMessages,
  ]
}

/**
 * Turno del agente con function calling nativo de OpenAI (streaming de texto + recopilación de tool calls).
 */
export async function chatOpenAIAgentTurn(
  messages: OpenAINativeMessage[],
  tools: ToolDefinition[],
  options: OpenAIOptions,
  onToken?: (text: string) => void,
): Promise<{ result: AgentTurnResult; rawToolCalls: OpenAIToolCall[]; assistantText: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      tools: toOpenAITools(tools),
      tool_choice: 'auto',
      stream: true,
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('No body in OpenAI response')

  let assistantText = ''
  // Acumula tool calls por índice
  const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map()

  await readSSEStream(res.body, data => {
    if (data === '[DONE]') return
    try {
      const chunk = JSON.parse(data) as OpenAIAgentChunk
      const choice = chunk.choices?.[0]
      if (!choice?.delta) return

      const delta = choice.delta
      if (delta.content) {
        assistantText += delta.content
        onToken?.(delta.content)
      }

      for (const tc of delta.tool_calls ?? []) {
        let acc = toolCallAccumulators.get(tc.index)
        if (!acc) {
          acc = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' }
          toolCallAccumulators.set(tc.index, acc)
        }
        if (tc.id) acc.id = tc.id
        if (tc.function?.name) acc.name = tc.function.name
        if (tc.function?.arguments) acc.args += tc.function.arguments
      }
    } catch { /* JSON incompleto */ }
  })

  const rawToolCalls: OpenAIToolCall[] = []
  const toolCalls: import('./agentTypes').ToolCall[] = []

  for (const [, acc] of toolCallAccumulators) {
    if (!acc.id || !acc.name) continue
    rawToolCalls.push({ id: acc.id, type: 'function', function: { name: acc.name, arguments: acc.args } })
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(acc.args) as Record<string, unknown> } catch { /* malformed */ }
    toolCalls.push({ id: acc.id, name: acc.name, input })
  }

  return { result: { text: assistantText, toolCalls }, rawToolCalls, assistantText }
}
