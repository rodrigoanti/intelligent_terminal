import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  buildExplainPrompt,
  buildChatSystemPrompt,
  buildAgentMdBootstrapMessages,
  buildAgentMdRefreshMessages,
  parseAgentMdRefreshResponse,
  stripOuterMarkdownFence,
  makeInteractionLogEntry,
  fallbackInteractionLogLine,
} from '@ai/ollamaClient'
import type { ChatMessage } from '@ai/types'
import { chatAI, aiOptionsFromConfig } from '@ai/aiClient'
import { useT } from '@i18n/useT'
import type { AppConfig, AgentShellPolicy } from '@shared/configSchema'
import type { ProjectAiContextForAi } from '@shared/projectAiContext'
import { runChatWithAgentFileLoop } from '../ai/agentModeRunner'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { AiPanelHeader } from './AiPanelHeader'
import { AiMessage } from './AiMessage'
import type { AiMessageEntry } from './AiMessage'
import { AiInputArea } from './AiInputArea'
import { AiEmptyState } from './AiEmptyState'
import './AiPanel.css'

const MAX_INTERACTIONS_LOG_ENTRIES = 120
const MAX_HISTORY_MESSAGES = 20
const MAX_HISTORY_MSG_CHARS = 4000

function cappedInteractionsLog(prev: string[], entry: string): string[] {
  const next = [...prev, entry]
  if (next.length <= MAX_INTERACTIONS_LOG_ENTRIES) return next
  return next.slice(-MAX_INTERACTIONS_LOG_ENTRIES)
}

interface Props {
  config: AppConfig
  sessionId: string
  selectedText: string
  getTerminalContext: () => string
  onInjectLine: (cmd: string) => void
  onCollapse: () => void
  onExpand: () => void
  expanded: boolean
  onConfigPatch?: (partial: Partial<AppConfig>) => void | Promise<void>
}

export const AiPanel: React.FC<Props> = ({
  config, sessionId, selectedText, getTerminalContext, onInjectLine, onCollapse, onExpand, expanded, onConfigPatch,
}) => {
  const { t } = useT()
  const [messages, setMessages] = useState<AiMessageEntry[]>([])
  const [interactionsLog, setInteractionsLog] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [shellPrompt, setShellPrompt] = useState<null | { cmd: string; resolve: (v: boolean) => void }>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const aiRequestInFlightRef = useRef(false)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevExpandedRef = useRef<boolean | null>(null)
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getTerminalContextRef = useRef(getTerminalContext)
  getTerminalContextRef.current = getTerminalContext

  const confirmShell = useCallback((cmd: string) => {
    return new Promise<boolean>(resolve => {
      setShellPrompt({ cmd, resolve })
    })
  }, [])

  const handleShellConfirm = useCallback((): void => {
    setShellPrompt(p => { if (p) p.resolve(true); return null })
  }, [])

  const handleShellCancel = useCallback((): void => {
    setShellPrompt(p => { if (p) p.resolve(false); return null })
  }, [])

  const scheduleInteractionLogUpdate = useCallback((userMsg: string, assistantMsg: string) => {
    function persist(entry: string): void {
      setInteractionsLog(prev => {
        const next = cappedInteractionsLog(prev, entry)
        window.api.saveInteractionsLog(sessionId, next)
        return next
      })
    }

    if (config.aiProvider === 'ollama') {
      void makeInteractionLogEntry(userMsg, assistantMsg, {
        baseURL: config.ollamaBaseURL,
        model: config.defaultModel,
        think: false,
        signal: AbortSignal.timeout(60_000),
      }).then(persist)
    } else {
      persist(fallbackInteractionLogLine(userMsg, assistantMsg))
    }
  }, [config.aiProvider, config.ollamaBaseURL, config.defaultModel, sessionId])

  const scheduleAgentMdRefreshAfterTurn = useCallback(
    (
      currentAgentMd: string | null,
      workspace: ProjectAiContextForAi | null,
      lastUserMessage: string,
      lastAssistantMessage: string,
    ) => {
      void (async () => {
        try {
          let tree = ''
          try { tree = await window.api.getAgentFolderTree(sessionId) } catch { tree = '(could not read folder tree)' }
          const terminalContext = getTerminalContextRef.current()
          const msgs = buildAgentMdRefreshMessages(currentAgentMd, tree, terminalContext, workspace, lastUserMessage, lastAssistantMessage)
          const raw = await chatAI(msgs, aiOptionsFromConfig(config, {
            signal: AbortSignal.timeout(120_000),
            think: false,
          }))
          const body = parseAgentMdRefreshResponse(raw)
          if (body?.trim()) {
            const writeRes = await window.api.writeAgentMd(sessionId, body)
            if (!writeRes.ok) console.error('[agentMd refresh] write failed:', writeRes.error)
          }
        } catch (e) {
          console.error('[agentMd refresh]', e)
        }
      })()
    },
    [sessionId, config],
  )

  useEffect(() => {
    if (!expanded) { prevExpandedRef.current = false; return }
    if (prevExpandedRef.current === null) { prevExpandedRef.current = true; return }
    const wasCollapsed = prevExpandedRef.current === false
    prevExpandedRef.current = true
    if (!wasCollapsed) return
    const id = requestAnimationFrame(() => { inputRef.current?.focus({ preventScroll: true }) })
    return () => cancelAnimationFrame(id)
  }, [expanded])

  const workspaceForPrompt = useCallback(async () => {
    try { return await window.api.getProjectAiContext(sessionId) } catch { return null }
  }, [sessionId])

  const ensureAgentMd = useCallback(
    async (workspace: ProjectAiContextForAi | null, terminalContext: string, signal: AbortSignal): Promise<string | null> => {
      try {
        const existing = await window.api.readAgentMd(sessionId)
        if (existing?.trim()) return existing.trim()
      } catch { /* bootstrap */ }
      let tree = ''
      try { tree = await window.api.getAgentFolderTree(sessionId) } catch { tree = '(could not read folder tree)' }
      const bootstrapMsgs = buildAgentMdBootstrapMessages(tree, terminalContext, workspace)
      const generated = await chatAI(bootstrapMsgs, aiOptionsFromConfig(config, { signal }))
      const body = stripOuterMarkdownFence(generated)
      if (!body.trim()) return null
      try {
        const writeRes = await window.api.writeAgentMd(sessionId, body)
        if (!writeRes.ok) console.error('[agentMd] escritura fallida:', writeRes.error)
      } catch (e) { console.error('[agentMd] escritura:', e) }
      return body
    },
    [sessionId, config],
  )

  useEffect(() => {
    void Promise.all([
      window.api.loadAiChat(sessionId),
      window.api.loadInteractionsLog(sessionId),
    ]).then(([saved, log]) => {
      if (saved.length > 0) {
        setMessages(
          saved
            .filter((e): e is AiMessageEntry =>
              typeof e?.id === 'string' &&
              (e.role === 'user' || e.role === 'assistant') &&
              typeof e.content === 'string',
            )
            .map(e => ({ ...e, isStreaming: false })),
        )
      }
      if (log.length > 0) {
        setInteractionsLog(log.length > MAX_INTERACTIONS_LOG_ENTRIES ? log.slice(-MAX_INTERACTIONS_LOG_ENTRIES) : log)
      }
      setChatLoaded(true)
    }).catch(() => setChatLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (!chatLoaded || messages.some(m => m.isStreaming)) return
    if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current)
    chatSaveTimerRef.current = setTimeout(() => {
      chatSaveTimerRef.current = null
      const toSave = messages.map(({ id, role, content, thinking }) => ({
        id, role, content, ...(thinking ? { thinking } : {}),
      }))
      window.api.saveAiChat(sessionId, toSave)
    }, 800)
  }, [messages, chatLoaded, sessionId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!chatLoaded) return
    if (selectedText.trim()) { void runExplain(selectedText) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLoaded])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const streaming = messages.some(m => m.isStreaming)
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: streaming ? 'auto' : 'smooth' })
    })
  }, [messages])

  function addEntry(role: AiMessageEntry['role'], content: string, isStreaming = false): string {
    const id = crypto.randomUUID()
    setMessages(prev => [...prev, { id, role, content, isStreaming }])
    return id
  }

  function updateEntry(id: string, content: string, isStreaming = false): void {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content, isStreaming } : m))
  }

  function updateEntryThinking(id: string, thinking: string, thinkingStreaming = false): void {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, thinking, thinkingStreaming } : m))
  }

  async function runExplain(text: string): Promise<void> {
    if (aiRequestInFlightRef.current) return
    aiRequestInFlightRef.current = true
    setLoading(true)
    setError(null)
    let assistantId = ''
    try {
      const workspace = await workspaceForPrompt()
      const userText = `Explain:\n\`\`\`\n${text.slice(0, 600)}\n\`\`\``
      const historyMsgs: ChatMessage[] = messages
        .filter(m => !m.isStreaming)
        .slice(-MAX_HISTORY_MESSAGES)
        .map(m => ({
          role: m.role,
          content: m.content.length > MAX_HISTORY_MSG_CHARS
            ? m.content.slice(0, MAX_HISTORY_MSG_CHARS) + '\n…[truncated]'
            : m.content,
        }))
      addEntry('user', userText)
      assistantId = addEntry('assistant', '…', true)
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const agentMd = await ensureAgentMd(workspace, getTerminalContextRef.current(), ctrl.signal)
      const [sysMsg, userMsg] = buildExplainPrompt(
        text, getTerminalContextRef.current(), workspace, agentMd,
        config.agentMode ?? false, config.agentShellPolicy ?? 'off', interactionsLog,
      )
      const initialMsgs: ChatMessage[] = [sysMsg, ...historyMsgs, userMsg]
      let full = ''
      let thinkingFull = ''
      const baseOpts = aiOptionsFromConfig(config, {
        signal: ctrl.signal,
        onThinkingToken: tok => { thinkingFull += tok; updateEntryThinking(assistantId, thinkingFull, true) },
      })
      if (config.agentMode) {
        full = await runChatWithAgentFileLoop(
          initialMsgs, sessionId,
          {
            ...baseOpts,
            shellPolicy: config.agentShellPolicy ?? 'off',
            confirmShell: config.agentShellPolicy === 'ask' ? confirmShell : undefined,
          },
          visible => updateEntry(assistantId, visible, true),
        )
      } else {
        await chatAI(initialMsgs, {
          ...baseOpts,
          onToken: tok => { full += tok; updateEntry(assistantId, full, true) },
        })
      }
      updateEntry(assistantId, full, false)
      if (thinkingFull) updateEntryThinking(assistantId, thinkingFull, false)
      if (full) {
        scheduleInteractionLogUpdate(text, full)
        scheduleAgentMdRefreshAfterTurn(agentMd ?? null, workspace, userText, full)
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(t('ai.connectError', { provider: config.aiProvider, message: (e as Error).message }))
        if (assistantId) updateEntry(assistantId, t('ai.noResponse'), false)
      }
    } finally {
      aiRequestInFlightRef.current = false
      setLoading(false)
      if (assistantId) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false, thinkingStreaming: false } : m),
        )
      }
    }
  }

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text) return
    if (aiRequestInFlightRef.current) return
    aiRequestInFlightRef.current = true
    setLoading(true)
    setError(null)
    let assistantId = ''
    try {
      const workspace = await workspaceForPrompt()
      const historyMsgs: ChatMessage[] = messages
        .filter(m => !m.isStreaming)
        .slice(-MAX_HISTORY_MESSAGES)
        .map(m => ({
          role: m.role,
          content: m.content.length > MAX_HISTORY_MSG_CHARS
            ? m.content.slice(0, MAX_HISTORY_MSG_CHARS) + '\n…[truncated]'
            : m.content,
        }))
      setInput('')
      addEntry('user', text)
      assistantId = addEntry('assistant', '…', true)
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const agentMd = await ensureAgentMd(workspace, getTerminalContextRef.current(), ctrl.signal)
      const systemContent = buildChatSystemPrompt(
        getTerminalContextRef.current(), workspace, agentMd,
        config.agentMode ?? false, config.agentShellPolicy ?? 'off', interactionsLog,
      )
      const history: ChatMessage[] = [
        { role: 'system', content: systemContent },
        ...historyMsgs,
        { role: 'user', content: text },
      ]
      let full = ''
      let thinkingFull = ''
      const baseOpts = aiOptionsFromConfig(config, {
        signal: ctrl.signal,
        onThinkingToken: tok => { thinkingFull += tok; updateEntryThinking(assistantId, thinkingFull, true) },
      })
      if (config.agentMode) {
        full = await runChatWithAgentFileLoop(
          history, sessionId,
          {
            ...baseOpts,
            shellPolicy: config.agentShellPolicy ?? 'off',
            confirmShell: config.agentShellPolicy === 'ask' ? confirmShell : undefined,
          },
          visible => updateEntry(assistantId, visible, true),
        )
      } else {
        await chatAI(history, {
          ...baseOpts,
          onToken: tok => { full += tok; updateEntry(assistantId, full, true) },
        })
      }
      updateEntry(assistantId, full, false)
      if (thinkingFull) updateEntryThinking(assistantId, thinkingFull, false)
      if (full) {
        scheduleInteractionLogUpdate(text, full)
        scheduleAgentMdRefreshAfterTurn(agentMd ?? null, workspace, text, full)
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(t('ai.connectError', { provider: config.aiProvider, message: (e as Error).message }))
        if (assistantId) updateEntry(assistantId, t('ai.noResponse'), false)
      }
    } finally {
      aiRequestInFlightRef.current = false
      setLoading(false)
      if (assistantId) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false, thinkingStreaming: false } : m),
        )
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); void handleSend() }
  }

  function handleStop(): void {
    abortRef.current?.abort()
    setLoading(false)
  }

  function handleDeleteHistory(): void { setConfirmingDelete(true) }

  function confirmDelete(): void {
    setMessages([])
    setInteractionsLog([])
    setConfirmingDelete(false)
    window.api.deleteAiChat(sessionId)
    window.api.deleteInteractionsLog(sessionId)
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const t = e.target as HTMLElement
    if (t.closest('.toggle') || t.closest('.select')) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChromeToggle() }
  }

  function handleChromeToggle(): void {
    if (expanded) onCollapse()
    else onExpand()
  }

  return (
    <>
      <div className={['ai-panel', expanded ? 'ai-panel--dock-expanded' : 'ai-panel--dock-collapsed'].filter(Boolean).join(' ')}>
        <AiPanelHeader
          config={config}
          expanded={expanded}
          hasMessages={messages.length > 0}
          onToggleExpand={handleChromeToggle}
          onKeyDown={handleHeaderKeyDown}
          canConfigPatch={!!onConfigPatch}
          onAgentToggle={e => { e.stopPropagation(); void onConfigPatch?.({ agentMode: !config.agentMode }) }}
          onThinkToggle={e => { e.stopPropagation(); void onConfigPatch?.({ thinkingMode: !config.thinkingMode }) }}
          onShellPolicyChange={policy => { void onConfigPatch?.({ agentShellPolicy: policy }) }}
          onDeleteHistory={e => { e.stopPropagation(); handleDeleteHistory() }}
        />

        {expanded && (
          <div className="ai-panel-expanded-body">
            <div className="ai-messages" ref={messagesScrollRef}>
              {messages.length === 0 && <AiEmptyState />}
              {messages.map(msg => (
                <AiMessage key={msg.id} message={msg} onInsert={onInjectLine} />
              ))}
            </div>

            {error && (
              <div className="ai-error" role="alert">
                <span aria-hidden="true">!</span>
                <span>{error}</span>
              </div>
            )}

            <AiInputArea
              value={input}
              loading={loading}
              onChange={setInput}
              onSend={() => void handleSend()}
              onStop={handleStop}
              onKeyDown={handleKeyDown}
              inputRef={inputRef}
            />
          </div>
        )}
      </div>

      {createPortal(
        <ConfirmTerminalModal
          open={confirmingDelete}
          message={t('ai.confirmDeleteMessage')}
          detail={t('ai.confirmDeleteDetail')}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />,
        document.body,
      )}
      {createPortal(
        <ConfirmTerminalModal
          open={shellPrompt !== null}
          zIndex={760}
          message={t('ai.confirmShellMessage')}
          detail={shellPrompt?.cmd}
          onConfirm={handleShellConfirm}
          onCancel={handleShellCancel}
        />,
        document.body,
      )}
    </>
  )
}
