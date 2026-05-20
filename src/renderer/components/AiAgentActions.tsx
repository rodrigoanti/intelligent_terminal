import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import type { AssistantSegment } from './ai/parseAssistantContent'

const PREVIEW_LINES = 8

function basename(path: string): string {
  const p = path.replace(/\\/g, '/')
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(i + 1) : p
}

function FilePath({ path }: { path: string }): React.ReactElement {
  const base = basename(path)
  const dir = path.length > base.length ? path.slice(0, path.length - base.length).replace(/\/$/, '') : ''
  return (
    <span className="ai-action-path">
      {dir && <span className="ai-action-path__dir">{dir}/</span>}
      <span className="ai-action-path__file">{base}</span>
    </span>
  )
}

interface AiAgentActionSegmentProps {
  segment: Exclude<AssistantSegment, { type: 'text' } | { type: 'code' }>
  isStreaming: boolean
  compact?: boolean
}

export const AiAgentActionSegment: React.FC<AiAgentActionSegmentProps> = ({
  segment,
  isStreaming,
  compact = false,
}) => {
  const { t } = useT()
  const [writeOpen, setWriteOpen] = useState(false)
  const compactClass = compact ? ' ai-action--compact' : ''

  switch (segment.type) {
    case 'grep': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--grep${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">⌕</span>
            <span className="ai-action__title">
              {segment.queries.length === 1
                ? t('ai.actionGrepOne')
                : t('ai.actionGrepMany', { count: segment.queries.length })}
            </span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          <ul className="ai-action__list ai-action__list--detail">
            {segment.queries.map((q, idx) => (
              <li key={`${idx}-${q.pattern}`}>
                <code className="ai-action__grep-pattern">{q.pattern}</code>
                <span className="ai-action__reason">
                  {q.scope === '.' ? t('ai.actionGrepScopeAll') : q.scope}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'list': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--list${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">▤</span>
            <span className="ai-action__title">{t('ai.actionList')}</span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          <ul className="ai-action__list">
            {(segment.dirs.length > 0 ? segment.dirs : ['.']).map(d => (
              <li key={d}><code className="ai-action__cmd">{d}</code></li>
            ))}
          </ul>
        </div>
      )
    }

    case 'glob': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--glob${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">◫</span>
            <span className="ai-action__title">{t('ai.actionGlob')}</span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          <ul className="ai-action__list">
            {segment.patterns.map(p => (
              <li key={p}><code className="ai-action__grep-pattern">{p}</code></li>
            ))}
          </ul>
        </div>
      )
    }

    case 'git': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--git${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">⎇</span>
            <span className="ai-action__title">{t('ai.actionGit', { command: segment.command })}</span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          {segment.paths.length > 0 && (
            <ul className="ai-action__list">
              {segment.paths.map(p => (
                <li key={p}><FilePath path={p} /></li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    case 'read': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--read${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">↓</span>
            <span className="ai-action__title">
              {segment.requests.length === 1
                ? t('ai.actionReadOne')
                : t('ai.actionReadMany', { count: segment.requests.length })}
            </span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          <ul className="ai-action__list ai-action__list--detail">
            {segment.requests.map(r => (
              <li key={`${r.path}:${r.startLine ?? ''}`}>
                <FilePath path={r.path} />
                {r.startLine != null && r.endLine != null && (
                  <span className="ai-action__reason">
                    {t('ai.actionReadLines', { start: r.startLine, end: r.endLine })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'patch': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--patch${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">⊕</span>
            <span className="ai-action__title">
              {pending ? t('ai.actionPatchPending') : t('ai.actionPatchDone')}
            </span>
          </div>
          <div className="ai-action__path-row">
            <FilePath path={segment.path} />
            {segment.hunkCount > 0 && (
              <span className="ai-action__reason">
                {t('ai.actionPatchHunks', { count: segment.hunkCount })}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'write': {
      const pending = segment.pending && isStreaming
      const lines = segment.content.split('\n')
      const preview = lines.slice(0, PREVIEW_LINES).join('\n')
      const hasMore = lines.length > PREVIEW_LINES
      return (
        <div className={`ai-action ai-action--write${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">✎</span>
            <span className="ai-action__title">
              {pending ? t('ai.actionWritePending') : t('ai.actionWriteDone')}
            </span>
          </div>
          <div className="ai-action__path-row">
            <FilePath path={segment.path} />
            {!pending && segment.content && (
              <button
                type="button"
                className="ai-action__toggle"
                onClick={() => setWriteOpen(v => !v)}
                aria-expanded={writeOpen}
              >
                {writeOpen ? t('ai.actionHidePreview') : t('ai.actionShowPreview')}
              </button>
            )}
          </div>
          {!pending && segment.content && writeOpen && (
            <pre className="ai-action__preview">{preview}{hasMore ? '\n…' : ''}</pre>
          )}
          {!pending && !segment.content && (
            <p className="ai-action__hint">{t('ai.actionWriteEmpty')}</p>
          )}
        </div>
      )
    }

    case 'run': {
      const pending = segment.pending && isStreaming
      return (
        <div className={`ai-action ai-action--run${pending ? ' ai-action--pending' : ''}${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">▶</span>
            <span className="ai-action__title">
              {segment.commands.length === 1
                ? t('ai.actionRunOne')
                : t('ai.actionRunMany', { count: segment.commands.length })}
            </span>
            {pending && <span className="ai-action__status">{t('ai.actionPending')}</span>}
          </div>
          <ul className="ai-action__cmds">
            {segment.commands.map((cmd, idx) => (
              <li key={`${idx}-${cmd}`}>
                <code className="ai-action__cmd">{cmd}</code>
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'files-written':
      return (
        <div className={`ai-action ai-action--success${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">✓</span>
            <span className="ai-action__title">{t('ai.actionFilesWritten')}</span>
          </div>
          <ul className="ai-action__list">
            {segment.paths.map(p => (
              <li key={p}><FilePath path={p} /></li>
            ))}
          </ul>
        </div>
      )

    case 'patches-applied':
      return (
        <div className={`ai-action ai-action--success${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">✓</span>
            <span className="ai-action__title">{t('ai.actionPatchesApplied')}</span>
          </div>
          <ul className="ai-action__list">
            {segment.paths.map(p => (
              <li key={p}><FilePath path={p} /></li>
            ))}
          </ul>
        </div>
      )

    case 'writes-blocked':
      return (
        <div className={`ai-action ai-action--blocked${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">⊘</span>
            <span className="ai-action__title">{t('ai.actionWritesBlocked')}</span>
          </div>
          <ul className="ai-action__list ai-action__list--detail">
            {segment.items.map(item => (
              <li key={item.path}>
                <FilePath path={item.path} />
                <span className="ai-action__reason">{item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'patches-blocked':
      return (
        <div className={`ai-action ai-action--blocked${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">⊘</span>
            <span className="ai-action__title">{t('ai.actionPatchesBlocked')}</span>
          </div>
          <ul className="ai-action__list ai-action__list--detail">
            {segment.items.map(item => (
              <li key={item.path}>
                <FilePath path={item.path} />
                <span className="ai-action__reason">{item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'write-errors':
    case 'patch-errors':
      return (
        <div className={`ai-action ai-action--error${compactClass}`}>
          <div className="ai-action__head">
            <span className="ai-action__glyph" aria-hidden="true">✗</span>
            <span className="ai-action__title">
              {segment.type === 'patch-errors' ? t('ai.actionPatchErrors') : t('ai.actionWriteErrors')}
            </span>
          </div>
          <ul className="ai-action__list ai-action__list--detail">
            {segment.items.map(item => (
              <li key={item.path}>
                <FilePath path={item.path} />
                {item.message && <span className="ai-action__reason">{item.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )

    case 'agent-limit':
      return (
        <div className={`ai-action ai-action--limit${compactClass}`}>
          <span className="ai-action__glyph" aria-hidden="true">!</span>
          <span className="ai-action__title">{segment.message}</span>
        </div>
      )

    default:
      return null
  }
}
