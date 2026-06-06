import React, { useCallback, useEffect, useState } from 'react'
import type { GitHubActionsSnapshot } from '@shared/githubActionsTypes'
import type { GitRepoStatus } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
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
  const { t } = useT()
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
    <aside className="gh-actions-panel" aria-label={t('githubActions.title')}>
      <header className="gh-actions-panel__header">
        <h3 className="gh-actions-panel__title">{t('githubActions.title')}</h3>
        <Button
          variant="secondary"
          size="sm"
          disabled={!repoStatus?.isRepo || loading}
          onClick={() => void refresh()}
        >
          {t('githubActions.refresh')}
        </Button>
      </header>

      <div className="gh-actions-panel__body">
        {!repoStatus?.isRepo && (
          <p className="gh-actions-panel__hint">{t('githubActions.notInRepo')}</p>
        )}

        {repoStatus?.isRepo && loading && !snapshot && (
          <div className="gh-actions-panel__loading">
            <Spinner aria-label={t('githubActions.loadingAriaLabel')} />
          </div>
        )}

        {repoStatus?.isRepo && snapshot && !snapshot.ok && (
          <div className="gh-actions-panel__error" role="alert">
            <p>{snapshot.error ?? t('githubActions.loadFailed')}</p>
            {snapshot.errorCode === 'gh_missing' && (
              <p className="gh-actions-panel__error-hint">
                {t('githubActions.ghMissingHint')}{' '}
                <button
                  type="button"
                  className="gh-actions-panel__link"
                  onClick={() => void openUrl('https://cli.github.com/')}
                >
                  {t('githubActions.ghMissingLink')}
                </button>
                .
              </p>
            )}
            {snapshot.errorCode === 'gh_not_authed' && (
              <p className="gh-actions-panel__error-hint">{t('githubActions.ghNotAuthedHint')}</p>
            )}
            {snapshot.errorCode === 'not_github' && (
              <p className="gh-actions-panel__error-hint">{t('githubActions.notGithubHint')}</p>
            )}
          </div>
        )}

        {repoStatus?.isRepo && snapshot?.ok && snapshot.runs.length === 0 && (
          <p className="gh-actions-panel__hint">{t('githubActions.noRuns')}</p>
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
            {t('githubActions.viewAll')}
          </button>
        </footer>
      )}
    </aside>
  )
}
