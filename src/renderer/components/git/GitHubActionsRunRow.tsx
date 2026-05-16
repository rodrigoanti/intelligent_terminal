import React from 'react'
import type { GitHubActionsRun } from '@shared/githubActionsTypes'

function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diffMs = Date.now() - t
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `hace ${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `hace ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 48) return `hace ${hr}h`
  const days = Math.round(hr / 24)
  return `hace ${days}d`
}

function runStatusKind(run: GitHubActionsRun): 'success' | 'failure' | 'cancelled' | 'running' | 'neutral' {
  const c = (run.conclusion ?? '').toLowerCase()
  if (c === 'success') return 'success'
  if (c === 'failure') return 'failure'
  if (c === 'cancelled' || c === 'skipped') return 'cancelled'
  const s = run.status.toLowerCase()
  if (s === 'in_progress' || s === 'queued' || s === 'waiting' || s === 'pending') return 'running'
  return 'neutral'
}

interface GitHubActionsRunRowProps {
  run: GitHubActionsRun
  onOpen: (url: string) => void
}

export const GitHubActionsRunRow: React.FC<GitHubActionsRunRowProps> = ({ run, onOpen }) => {
  const kind = runStatusKind(run)
  const label =
    run.conclusion ??
    (kind === 'running' ? run.status.replace(/_/g, ' ') : run.status)

  return (
    <button
      type="button"
      className="gh-actions-run-row"
      onClick={() => {
        if (run.url) void onOpen(run.url)
      }}
      disabled={!run.url}
      title={run.url || undefined}
    >
      <span className={`gh-actions-run-row__dot gh-actions-run-row__dot--${kind}`} aria-hidden />
      <span className="gh-actions-run-row__body">
        <span className="gh-actions-run-row__title">{run.title}</span>
        <span className="gh-actions-run-row__meta">
          {run.headBranch && <span className="gh-actions-run-row__branch">{run.headBranch}</span>}
          {run.event && <span className="gh-actions-run-row__event">{run.event}</span>}
          <span className="gh-actions-run-row__time">{formatRelativeTime(run.updatedAt || run.createdAt)}</span>
        </span>
      </span>
      <span className={`gh-actions-run-row__status gh-actions-run-row__status--${kind}`}>
        {label}
      </span>
    </button>
  )
}
