/**
 * Tipos compartidos para el bucle de agente con tool calling nativo.
 * Independientes del proveedor (Anthropic / OpenAI).
 */

export interface ToolCall {
  /** Identificador único del tool call (asignado por el proveedor). */
  id: string
  name: string
  /** Argumentos ya parseados del JSON que el modelo generó. */
  input: Record<string, unknown>
}

/** Resultado de ejecutar una herramienta. */
export interface ToolResult {
  toolCallId: string
  content: string
}

/** Respuesta de un turno del agente — texto visible + tool calls pendientes. */
export interface AgentTurnResult {
  text: string
  toolCalls: ToolCall[]
}
