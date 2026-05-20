import React from 'react'
import { useT } from '@i18n/useT'
import { AiAgentActionSegment } from './AiAgentActions'
import type { AssistantSegment } from './ai/parseAssistantContent'

type ActionSegment = Exclude<AssistantSegment, { type: 'text' } | { type: 'code' }>

const ACTION_KIND_ORDER: Record<string, number> = {
  grep: 0,
  glob: 1,
  list: 2,
  git: 3,
  read: 4,
  run: 5,
  patch: 6,
  write: 7,
  'files-written': 8,
  'patches-applied': 8,
  'writes-blocked': 9,
  'patches-blocked': 9,
  'write-errors': 10,
  'patch-errors': 10,
  'agent-limit': 11,
}

function sortActions(a: ActionSegment, b: ActionSegment): number {
  const oa = ACTION_KIND_ORDER[a.type] ?? 50
  const ob = ACTION_KIND_ORDER[b.type] ?? 50
  return oa - ob
}

interface AiAgentRunGroupProps {
  segments: ActionSegment[]
  isStreaming: boolean
}

export const AiAgentRunGroup: React.FC<AiAgentRunGroupProps> = ({ segments, isStreaming }) => {
  const { t } = useT()
  const pending =
    isStreaming &&
    segments.some(s => 'pending' in s && Boolean((s as { pending?: boolean }).pending))
  const sorted = [...segments].sort(sortActions)

  return (
    <div className={`ai-agent-run${pending ? ' ai-agent-run--pending' : ''}`}>
      <div className="ai-agent-run__header">
        <span className="ai-agent-run__dot" aria-hidden="true" />
        <span className="ai-agent-run__title">{t('ai.actionRunGroupTitle')}</span>
        <span className="ai-agent-run__count">{sorted.length}</span>
        {pending && <span className="ai-agent-run__status">{t('ai.actionPending')}</span>}
      </div>
      <div className="ai-agent-run__timeline">
        {sorted.map((seg, i) => (
          <div key={`${seg.type}-${i}`} className="ai-agent-run__step">
            <span className="ai-agent-run__rail" aria-hidden="true" />
            <div className="ai-agent-run__card">
              <AiAgentActionSegment segment={seg} isStreaming={isStreaming} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
