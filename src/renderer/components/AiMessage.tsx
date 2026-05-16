import React from 'react'
import { AiCodeBlock } from './AiCodeBlock'
import { AiThinkingBlock } from './AiThinkingBlock'

type Segment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = []
  const re = /```([^\n`]*)\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', content: raw.slice(last, m.index) })
    }
    segments.push({ type: 'code', lang: m[1].trim(), content: m[2].trimEnd() })
    last = m.index + m[0].length
  }
  if (last < raw.length) {
    segments.push({ type: 'text', content: raw.slice(last) })
  }
  return segments
}

interface AiAssistantContentProps {
  content: string
  thinking?: string
  thinkingStreaming?: boolean
  isStreaming: boolean
  onInsert: (cmd: string) => void
}

export const AiAssistantContent: React.FC<AiAssistantContentProps> = ({
  content,
  thinking,
  thinkingStreaming,
  isStreaming,
  onInsert,
}) => {
  const segments = parseSegments(content)
  return (
    <>
      {thinking && (
        <AiThinkingBlock content={thinking} isStreaming={!!thinkingStreaming} />
      )}
      {segments.map((seg, i) => {
        const isLastSegment = i === segments.length - 1
        if (seg.type === 'code') {
          return (
            <AiCodeBlock
              key={i}
              lang={seg.lang}
              content={seg.content}
              isStreaming={isStreaming}
              isLastSegment={isLastSegment}
              onInsert={onInsert}
            />
          )
        }
        return (
          <pre key={i} className="ai-msg-pre">
            {seg.content}
            {isStreaming && isLastSegment && <span className="ai-cursor">▌</span>}
          </pre>
        )
      })}
    </>
  )
}

interface AiUserContentProps {
  content: string
  isStreaming: boolean
}

export const AiUserContent: React.FC<AiUserContentProps> = ({ content, isStreaming }) => (
  <div className="ai-msg-content-inner ai-msg-content-inner--user">
    <pre className="ai-msg-pre">
      {content}
      {isStreaming && <span className="ai-cursor">▌</span>}
    </pre>
  </div>
)

export interface AiMessageEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  thinking?: string
  thinkingStreaming?: boolean
}

interface AiMessageProps {
  message: AiMessageEntry
  onInsert: (cmd: string) => void
}

export const AiMessage: React.FC<AiMessageProps> = ({ message, onInsert }) => (
  <div
    className={`ai-msg ai-msg--${message.role}`}
    aria-label={message.role === 'user' ? 'Tu mensaje' : 'Respuesta del modelo'}
  >
    <div className="ai-msg-bubble">
      <div className="ai-msg-content">
        {message.role === 'assistant' ? (
          <AiAssistantContent
            content={message.content}
            thinking={message.thinking}
            thinkingStreaming={message.thinkingStreaming}
            isStreaming={!!message.isStreaming}
            onInsert={onInsert}
          />
        ) : (
          <AiUserContent content={message.content} isStreaming={!!message.isStreaming} />
        )}
      </div>
    </div>
  </div>
)
