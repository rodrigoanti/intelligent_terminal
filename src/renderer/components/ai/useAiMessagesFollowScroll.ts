import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { isAiMessagesNearBottom, scrollAiMessagesToBottom } from './aiMessagesScroll'

export interface AiMessagesFollowEntry {
  isStreaming?: boolean
}

/**
 * Mantiene el chat pegado al fondo sólo mientras el usuario siga en el fondo.
 * La decisión se basa en la posición previa al update, no en el `scrollHeight`
 * posterior; así evitamos perder el follow cuando llega más contenido.
 */
export function useAiMessagesFollowScroll(
  messages: AiMessagesFollowEntry[],
  expanded: boolean,
  scrollRef: RefObject<HTMLDivElement | null>,
): void {
  const shouldFollowRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateShouldFollow = (): void => {
      shouldFollowRef.current = isAiMessagesNearBottom(el)
    }

    updateShouldFollow()
    el.addEventListener('scroll', updateShouldFollow, { passive: true })
    return () => el.removeEventListener('scroll', updateShouldFollow)
  }, [scrollRef])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    scrollAiMessagesToBottom(el, () => shouldFollowRef.current)
  }, [messages, scrollRef])

  useLayoutEffect(() => {
    if (!expanded) return
    const el = scrollRef.current
    if (el) scrollAiMessagesToBottom(el, true)
  }, [expanded, scrollRef])
}
