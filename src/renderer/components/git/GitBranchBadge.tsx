import React from 'react'
import type { GitRepoStatus } from '@shared/gitSessionTypes'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'

interface GitBranchBadgeProps {
  status: GitRepoStatus
  /** Por defecto muestra la etiqueta «rama»; con `icon` solo ícono git-branch (usa title para el detalle). */
  labelStyle?: 'text' | 'icon'
}

function branchTooltip(status: GitRepoStatus): string {
  const parts: string[] = []
  if (status.branch) parts.push(`Rama: ${status.branch}`)
  if (status.upstream) parts.push(`Upstream: ${status.upstream}`)
  if (typeof status.ahead === 'number' && status.ahead > 0) parts.push(`adelante +${status.ahead}`)
  if (typeof status.behind === 'number' && status.behind > 0) parts.push(`atrás −${status.behind}`)
  return parts.length > 0 ? parts.join(' · ') : 'Rama'
}

export const GitBranchBadge: React.FC<GitBranchBadgeProps> = ({ status, labelStyle = 'text' }) => {
  if (!status.isRepo) return null
  const tip = branchTooltip(status)
  return (
    <div
      className={`git-branch-badge${labelStyle === 'icon' ? ' git-branch-badge--icon-label' : ''}`}
      title={tip}
    >
      {labelStyle === 'icon' ? (
        <span className="git-branch-badge__icon-wrap" aria-hidden>
          <Icon name="git-branch" size={14} />
        </span>
      ) : (
        <span className="git-branch-badge__label">rama</span>
      )}
      <code className="git-branch-badge__name">{status.branch ?? '—'}</code>
      {status.upstream && (
        <span className="git-branch-badge__upstream" title="Upstream">
          → <code>{status.upstream}</code>
        </span>
      )}
      {typeof status.ahead === 'number' && status.ahead > 0 && (
        <Badge variant="accent">{`+${status.ahead}`}</Badge>
      )}
      {typeof status.behind === 'number' && status.behind > 0 && (
        <Badge variant="muted">{`−${status.behind}`}</Badge>
      )}
    </div>
  )
}
