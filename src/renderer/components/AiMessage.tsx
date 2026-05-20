import React from 'react'
import { useT } from '@i18n/useT'
import { AiCodeBlock } from './AiCodeBlock'
import { AiMarkdown } from './AiMarkdown'
import { AiThinkingBlock } from './AiThinkingBlock'
import { AiAgentActionSegment } from './AiAgentActions'
import { AiAgentRunGroup } from './AiAgentRunGroup'
import { AiErrorBoundary } from './AiErrorBoundary'
import { parseAssistantContent, type AssistantSegment } from './ai/parseAssistantContent'

type ActionSegment = Exclude<AssistantSegment, { type: 'text' } | { type: 'code' }>

type RenderUnit =
  | { kind: 'segment'; segment: AssistantSegment; key: string }
  | { kind: 'action-group'; segments: ActionSegment[]; key: string }

function isActionSegment(seg: AssistantSegment): seg is ActionSegment {
  return seg.type !== 'text' && seg.type !== 'code'
}

function buildRenderUnits(segments: AssistantSegment[]): RenderUnit[] {
  const units: RenderUnit[] = []
  let i = 0
  while (i < segments.length) {
    const seg = segments[i]
    if (!isActionSegment(seg)) {
      units.push({ kind: 'segment', segment: seg, key: `s-${i}` })
      i++
      continue
    }
    const group: ActionSegment[] = []
    const start = i
    while (i < segments.length && isActionSegment(segments[i])) {
      group.push(segments[i] as ActionSegment)
      i++
    }
    units.push({ kind: 'action-group', segments: group, key: `g-${start}` })
  }
  return units
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
  const units = buildRenderUnits(parseAssistantContent(content))

  return (
    <>
      {thinking && (
        <AiThinkingBlock content={thinking} isStreaming={!!thinkingStreaming} />
      )}
      {units.map((unit, unitIdx) => {
        if (unit.kind === 'action-group') {
          return (
            <AiAgentRunGroup
              key={unit.key}
              segments={unit.segments}
              isStreaming={isStreaming}
            />
          )
        }

        const seg = unit.segment
        const isLastUnit = unitIdx === units.length - 1

        if (seg.type === 'code') {
          return (
            <AiCodeBlock
              key={unit.key}
              lang={seg.lang}
              content={seg.content}
              isStreaming={isStreaming}
              isLastSegment={isLastUnit}
              onInsert={onInsert}
            />
          )
        }

        if (seg.type !== 'text') {
          return (
            <AiAgentActionSegment
              key={unit.key}
              segment={seg}
              isStreaming={isStreaming}
            />
          )
        }

        if (!seg.content.trim()) return null

        return (
          <AiMarkdown
            key={unit.key}
            content={seg.content}
            showCursor={isStreaming && isLastUnit}
          />
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

export const AiMessage: React.FC<AiMessageProps> = ({ message, onInsert }) => {
  const { t } = useT()
  return (
    <div
      className={`ai-msg ai-msg--${message.role}`}
      aria-label={message.role === 'user' ? t('ai.userAriaLabel') : t('ai.assistantAriaLabel')}
    >
      <div className="ai-msg-bubble">
        <div className="ai-msg-content">
          <AiErrorBoundary>
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
          </AiErrorBoundary>
        </div>
      </div>
    </div>
  )
}
