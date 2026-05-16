import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { GitCommandResult, GitRepoStatus } from '@shared/gitSessionTypes'
import { suggestGitCommitMessage } from '@ai/ollamaClient'
import { TerminalModal } from './TerminalModal'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { Button } from './ui/Button'
import { TextArea } from './ui/TextArea'
import { Spinner } from './ui/Spinner'
import { Icon } from './ui/Icon'
import { GitBranchBadge } from './git/GitBranchBadge'
import { GitDiffBlocks } from './git/GitDiffBlocks'
import { GitHubActionsPanel } from './git/GitHubActionsPanel'
import './GitPanelModal.css'

function formatGitResult(label: string, r: GitCommandResult): string {
  const parts = [
    `— ${label} (exit ${r.exitCode ?? '?'}) —`,
    r.stderr.trim() && `stderr:\n${r.stderr.trim()}`,
    r.stdout.trim() && `stdout:\n${r.stdout.trim()}`,
  ].filter(Boolean)
  return parts.join('\n\n')
}

interface GitPanelModalProps {
  open: boolean
  sessionId: string
  config: AppConfig
  onClose: () => void
}

export const GitPanelModal: React.FC<GitPanelModalProps> = ({
  open,
  sessionId,
  config,
  onClose,
}) => {
  const [status, setStatus] = useState<GitRepoStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastLog, setLastLog] = useState('')
  const [commitMsg, setCommitMsg] = useState('')
  const [confirmStageOpen, setConfirmStageOpen] = useState(false)
  const [actionsRefreshToken, setActionsRefreshToken] = useState(0)
  const aiAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort()
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const s = await window.api.gitStatus(sessionId)
      setStatus(s)
    } catch (e) {
      setStatus({
        isRepo: false,
        sessionCwd: '',
        files: [],
        hasStaged: false,
        hasUnstaged: false,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const refreshAll = useCallback((): void => {
    void refresh()
    setActionsRefreshToken(t => t + 1)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setCommitMsg('')
    setLastLog('')
    refreshAll()
  }, [open, refreshAll])

  const runAndLog = useCallback(
    async (label: string, fn: () => Promise<GitCommandResult>): Promise<void> => {
      setBusy(label)
      try {
        const r = await fn()
        setLastLog(formatGitResult(label, r))
        await refresh()
      } catch (e) {
        setLastLog(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusy(null)
      }
    },
    [refresh],
  )

  const onPull = (): void => {
    void runAndLog('git pull', () => window.api.gitPull(sessionId))
  }

  const onPush = (): void => {
    void runAndLog('git push', () => window.api.gitPush(sessionId))
  }

  const onCommit = (): void => {
    const msg = commitMsg.trim()
    if (!msg) {
      setLastLog('Escribe un mensaje de commit.')
      return
    }
    void (async (): Promise<void> => {
      await runAndLog('git commit', () => window.api.gitCommit(sessionId, msg))
      setCommitMsg('')
    })()
  }

  const onConfirmStageAll = (): void => {
    setConfirmStageOpen(false)
    void runAndLog('git add -A', () => window.api.gitStageAll(sessionId))
  }

  const onSuggestAi = (): void => {
    aiAbortRef.current?.abort()
    const ctrl = new AbortController()
    aiAbortRef.current = ctrl
    setBusy('ai-suggest')
    setLastLog('')
    void (async (): Promise<void> => {
      try {
        const diff = await window.api.gitDiffForAi(sessionId)
        if (!diff.ok) {
          setLastLog(diff.error ?? 'No se pudo leer el diff para la IA.')
          return
        }
        const suggestion = await suggestGitCommitMessage(diff.text, {
          baseURL: config.ollamaBaseURL,
          model: config.defaultModel,
          signal: ctrl.signal,
        })
        setCommitMsg(suggestion)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setLastLog(`IA: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (aiAbortRef.current === ctrl) aiAbortRef.current = null
        setBusy(null)
      }
    })()
  }

  const repo = status?.isRepo === true
  const idle = !busy && !loading
  const canCommit =
    repo && status && status.hasStaged && commitMsg.trim().length > 0 && idle

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title="git"
        titleId="git-panel-title"
        size="xxl"
        zIndex={670}
        panelClassName="git-panel-modal-panel"
        bodyClassName="terminal-modal-body git-panel-body"
        footer={
          <span className="git-panel-footer-hint">
            cwd de la sesión · pull con --ff-only · commit solo con staging · Actions vía gh · esc cerrar
          </span>
        }
      >
        <div className="git-panel-layout">
          <div className="git-panel-layout__main">
        <div className="git-panel-scroll">
          {loading && !status && (
            <div className="git-panel-loading">
              <Spinner aria-label="Cargando estado git" />
            </div>
          )}

          {status && (
            <>
              <div className="git-panel-top-bar">
                <div className="git-panel-top-bar__lead">
                  <div
                    className="git-panel-top-bar__cwd"
                    title={`Carpeta de la sesión (cwd): ${status.sessionCwd || '—'}`}
                  >
                    <span className="git-panel-top-bar__cwd-icon" aria-hidden>
                      <Icon name="folder-filled" size={14} />
                    </span>
                    <code className="git-panel-top-bar__cwd-path">{status.sessionCwd || '—'}</code>
                  </div>
                  {status.isRepo && (
                    <div className="git-panel-top-bar__branch">
                      <GitBranchBadge status={status} labelStyle="icon" />
                    </div>
                  )}
                </div>
                <div className="git-panel-top-bar__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!repo || !idle}
                    onClick={refreshAll}
                  >
                    actualizar
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!repo || !idle} onClick={onPull}>
                    pull
                  </Button>
                </div>
              </div>

              {status.isRepo && status.repoRoot && status.repoRoot !== status.sessionCwd && (
                <div className="git-panel-meta git-panel-meta--extra">
                  <span className="git-panel-meta__label">raíz repo</span>
                  <code className="git-panel-meta__path">{status.repoRoot}</code>
                </div>
              )}

              {!status.isRepo && (
                <p className="git-panel-not-repo" role="alert">
                  {status.error ?? 'Esta carpeta no es un repositorio git.'}
                </p>
              )}

              {status.isRepo && (
                <>
                  <h3 className="git-panel-section-title">Resumen diff</h3>
                  <GitDiffBlocks
                    stagedTitle="En staging (git diff --cached --stat)"
                    stagedBody={status.stagedDiffStat ?? ''}
                    unstagedTitle="Sin staging (git diff --stat)"
                    unstagedBody={status.diffStat ?? ''}
                  />
                </>
              )}

              {repo && status && (
                <div className="git-panel-commit">
                  <h3 className="git-panel-section-title">Commit</h3>
                  <p className="git-panel-commit-hint">
                    Solo se incluyen cambios ya en <strong>staging</strong>.
                    {!status.hasStaged && ' Ahora no hay nada en staging.'}
                  </p>
                  <div className="git-panel-commit-row">
                    <Button variant="ghost" size="sm" disabled={!idle} onClick={onSuggestAi}>
                      {busy === 'ai-suggest' ? (
                        <Spinner aria-label="Generando mensaje" />
                      ) : (
                        <span className="git-panel-ia-suggest-inner">
                          <Icon name="sparkles" size={14} aria-hidden />
                          <span>IA: sugerir mensaje</span>
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!idle}
                      onClick={() => setConfirmStageOpen(true)}
                    >
                      stage all
                    </Button>
                  </div>
                  <TextArea
                    size="md"
                    rows={3}
                    placeholder="Mensaje de commit (una línea o varias)"
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    spellCheck
                  />
                  <Button variant="primary" size="sm" disabled={!canCommit} onClick={onCommit}>
                    commit
                  </Button>
                  <div className="git-panel-push-row">
                    <Button variant="secondary" size="sm" disabled={!repo || !idle} onClick={onPush}>
                      push
                    </Button>
                  </div>
                </div>
              )}

              {lastLog.trim().length > 0 && (
                <pre className="git-panel-log" role="log">{lastLog}</pre>
              )}
            </>
          )}
        </div>
          </div>
          <GitHubActionsPanel
            sessionId={sessionId}
            repoStatus={status}
            refreshToken={actionsRefreshToken}
          />
        </div>
      </TerminalModal>

      <ConfirmTerminalModal
        open={confirmStageOpen}
        zIndex={720}
        message="¿Hacer «git add -A» en la raíz del repo?"
        detail="Se añadirán al staging todos los cambios del repositorio (incl. borrados y nuevos archivos)."
        onCancel={() => setConfirmStageOpen(false)}
        onConfirm={onConfirmStageAll}
      />
    </>
  )
}
