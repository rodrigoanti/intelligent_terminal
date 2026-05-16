import React, { useEffect, useState } from 'react'

interface AiThinkingBlockProps {
  content: string
  isStreaming: boolean
}

export const AiThinkingBlock: React.FC<AiThinkingBlockProps> = ({ content, isStreaming }) => {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!isStreaming) setOpen(false)
  }, [isStreaming])

  return (
    <details
      className="ai-thinking-block"
      open={open}
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
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
