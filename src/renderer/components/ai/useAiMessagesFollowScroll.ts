import { useEffect, useRef, type RefObject } from 'react'
import { scrollAiMessagesToBottom } from './aiMessagesScroll'

export interface AiMessagesFollowEntry {
  isStreaming?: boolean
}

/**
 * Mantiene el scroll del chat al fondo durante streaming y al terminar el turno.
 * `wasStreamingRef` fuerza un último scroll cuando `isStreaming` pasa a false.
 */
export function useAiMessagesFollowScroll(
  messages: AiMessagesFollowEntry[],
  expanded: boolean,
  scrollRef: RefObject<HTMLDivElement | null>,
): void {
  const wasStreamingRef = useRef(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const streaming = messages.some(m => m.isStreaming)
    const force = streaming || wasStreamingRef.current
    wasStreamingRef.current = streaming
    scrollAiMessagesToBottom(el, force)
  }, [messages, scrollRef])

  useEffect(() => {
    if (!expanded) return
    const el = scrollRef.current
    if (el) scrollAiMessagesToBottom(el, true)
  }, [expanded, scrollRef])
}
