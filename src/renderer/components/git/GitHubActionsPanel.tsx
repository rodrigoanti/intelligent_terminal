import React, { useCallback, useEffect, useState } from 'react'
import type { GitHubActionsSnapshot } from '@shared/githubActionsTypes'
import type { GitRepoStatus } from '@shared/gitSessionTypes'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { GitHubActionsRunRow } from './GitHubActionsRunRow'
import './GitHubActionsPanel.css'

interface GitHubActionsPanelProps {
  sessionId: string
  repoStatus: GitRepoStatus | null
  refreshToken: number
}

export const GitHubActionsPanel: React.FC<GitHubActionsPanelProps> = ({
  sessionId,
  repoStatus,
  refreshToken,
}) => {
  const [snapshot, setSnapshot] = useState<GitHubActionsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (!repoStatus?.isRepo) {
      setSnapshot(null)
      return
    }
    setLoading(true)
    try {
      const s = await window.api.githubActionsList(sessionId)
      setSnapshot(s)
    } catch (e) {
      setSnapshot({
        ok: false,
        repo: null,
        runs: [],
        error: e instanceof Error ? e.message : String(e),
        errorCode: 'gh_failed',
      })
    } finally {
      setLoading(false)
    }
  }, [sessionId, repoStatus?.isRepo])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshToken])

  const openUrl = useCallback((url: string): void => {
    void window.api.openExternalUrl(url)
  }, [])

  const actionsUrl =
    snapshot?.repo != null
      ? `https://github.com/${snapshot.repo.fullName}/actions`
      : null

  return (
    <aside className="gh-actions-panel" aria-label="GitHub Actions">
      <header className="gh-actions-panel__header">
        <h3 className="gh-actions-panel__title">GitHub Actions</h3>
        <Button
          variant="secondary"
          size="sm"
          disabled={!repoStatus?.isRepo || loading}
          onClick={() => void refresh()}
        >
          actualizar
        </Button>
      </header>

      <div className="gh-actions-panel__body">
        {!repoStatus?.isRepo && (
          <p className="gh-actions-panel__hint">Abre el panel en un repositorio git.</p>
        )}

        {repoStatus?.isRepo && loading && !snapshot && (
          <div className="gh-actions-panel__loading">
            <Spinner aria-label="Cargando workflow runs" />
          </div>
        )}

        {repoStatus?.isRepo && snapshot && !snapshot.ok && (
          <div className="gh-actions-panel__error" role="alert">
            <p>{snapshot.error ?? 'No se pudieron cargar los runs.'}</p>
            {snapshot.errorCode === 'gh_missing' && (
              <p className="gh-actions-panel__error-hint">
                Instala{' '}
                <button
                  type="button"
                  className="gh-actions-panel__link"
                  onClick={() => void openUrl('https://cli.github.com/')}
                >
                  GitHub CLI
                </button>
                .
              </p>
            )}
            {snapshot.errorCode === 'gh_not_authed' && (
              <p className="gh-actions-panel__error-hint">Ejecuta <code>gh auth login</code> en una terminal.</p>
            )}
            {snapshot.errorCode === 'not_github' && (
              <p className="gh-actions-panel__error-hint">El remote <code>origin</code> debe ser de GitHub.</p>
            )}
          </div>
        )}

        {repoStatus?.isRepo && snapshot?.ok && snapshot.runs.length === 0 && (
          <p className="gh-actions-panel__hint">No hay workflow runs recientes.</p>
        )}

        {snapshot?.ok && snapshot.runs.length > 0 && (
          <ul className="gh-actions-panel__list">
            {snapshot.runs.map(run => (
              <li key={run.id}>
                <GitHubActionsRunRow run={run} onOpen={openUrl} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {actionsUrl && (
        <footer className="gh-actions-panel__footer">
          <button
            type="button"
            className="gh-actions-panel__link"
            onClick={() => void openUrl(actionsUrl)}
          >
            Ver todas en GitHub
          </button>
        </footer>
      )}
    </aside>
  )
}
