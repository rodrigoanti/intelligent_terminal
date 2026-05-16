import React from 'react'

interface AiCodeBlockProps {
  lang: string
  content: string
  isStreaming: boolean
  isLastSegment: boolean
  onInsert: (cmd: string) => void
}

export const AiCodeBlock: React.FC<AiCodeBlockProps> = ({
  lang,
  content,
  isStreaming,
  isLastSegment,
  onInsert,
}) => (
  <div className="ai-code-block">
    <div className="ai-code-chrome" aria-hidden="true">
      <span className="ai-code-lang">{lang.trim() || 'text'}</span>
    </div>
    <pre className="ai-code-pre">
      {content}
      {isStreaming && isLastSegment && <span className="ai-cursor">▌</span>}
    </pre>
    {!isStreaming && (
      <button
        type="button"
        className="ai-insert-btn"
        title="Ctrl+U + pegar en terminal (sin Enter)"
        onClick={() => onInsert(content)}
      >
        ↵ poner en terminal
      </button>
    )}
  </div>
)
