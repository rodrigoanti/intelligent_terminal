/** Mensaje de chat compatible con todos los proveedores de IA. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
