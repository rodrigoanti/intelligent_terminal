import React, { useEffect, useRef, useState } from 'react'
import { scrollAiMessagesToBottom } from './ai/aiMessagesScroll'

interface AiThinkingBlockProps {
  content: string
  isStreaming: boolean
}

function scrollNearestScrollable(el: HTMLElement): void {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    if (node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY !== 'visible') {
      scrollAiMessagesToBottom(node, true)
      return
    }
    node = node.parentElement
  }
}

export const AiThinkingBlock: React.FC<AiThinkingBlockProps> = ({ content, isStreaming }) => {
  const [open, setOpen] = useState(true)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (isStreaming) return
    // Colapsar tras el layout del mensaje final; si va en el mismo frame que el scroll
    // del chat, el scrollHeight baja y el viewport puede saltar arriba.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(false))
    })
    return () => cancelAnimationFrame(id)
  }, [isStreaming])

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>): void {
    const isNowOpen = e.currentTarget.open
    setOpen(isNowOpen)
    if (isNowOpen && detailsRef.current) {
      scrollNearestScrollable(detailsRef.current)
    }
  }

  return (
    <details
      ref={detailsRef}
      className="ai-thinking-block"
      open={open}
      onToggle={handleToggle}
    >
      <summary className="ai-thinking-summary">
        {isStreaming
          ? <><span className="ai-cursor">▌</span> thinking…</>
          : '▸ reasoning'}
      </summary>
      <pre className="ai-thinking-pre">{content}</pre>
    </details>
  )
}
