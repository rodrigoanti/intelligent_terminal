import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  chatOllama,
  buildExplainPrompt,
  buildChatSystemPrompt,
  buildAgentMdBootstrapMessages,
  buildAgentMdRefreshMessages,
  parseAgentMdRefreshResponse,
  stripOuterMarkdownFence,
  makeInteractionLogEntry,
} from '@ai/ollamaClient'
import type { ChatMessage } from '@ai/ollamaClient'
import type { AppConfig } from '@shared/configSchema'
import type { ProjectAiContextForAi } from '@shared/projectAiContext'
import { runChatWithAgentFileLoop } from '../ai/agentModeRunner'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import './AiPanel.css'

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  /** Razonamiento interno emitido por el modelo en modo thinking. */
  thinking?: string
  thinkingStreaming?: boolean
}

/** Límite de entradas persistidas y enviadas en el system prompt (evita crecimiento ilimitado). */
const MAX_INTERACTIONS_LOG_ENTRIES = 120

/**
 * Cuántos mensajes anteriores del hilo (user + assistant) se envían a Ollama en cada petición.
 * Se toman los más recientes. Con 20 = 10 pares de conversación con memoria real.
 */
const MAX_HISTORY_MESSAGES = 20

/**
 * Caracteres máximos por mensaje histórico antes de truncar.
 * Evita que respuestas largas (código, archivos) saturen el contexto.
 */
const MAX_HISTORY_MSG_CHARS = 4000

function cappedInteractionsLog(prev: string[], entry: string): string[] {
  const next = [...prev, entry]
  if (next.length <= MAX_INTERACTIONS_LOG_ENTRIES) return next
  return next.slice(-MAX_INTERACTIONS_LOG_ENTRIES)
}

// ── Renderizado de mensajes del asistente con bloques de código ────────────

type Segment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = []
  // Acepta bloques con o sin salto de línea después de los backticks
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

interface ThinkingBlockProps {
  content: string
  isStreaming: boolean
}

function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!isStreaming) setOpen(false)
  }, [isStreaming])

  return (
    <details
      className="ai-thinking-block"
      open={open}
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="ai-thinking-summary">
        {isStreaming
          ? <><span className="ai-cursor">▌</span> thinking…</>
          : '▸ reasoning'}
      </summary>
      <pre className="ai-thinking-pre">{content}</pre>
    </details>
  )
}

interface MsgContentProps {
  content: string
  isStreaming: boolean
  onInsert: (cmd: string) => void
}

function MsgContent({ content, isStreaming, onInsert }: MsgContentProps) {
  const segments = parseSegments(content)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          const langLabel = seg.lang.trim() || 'text'
          return (
            <div key={i} className="ai-code-block">
              <div className="ai-code-chrome" aria-hidden="true">
                <span className="ai-code-lang">{langLabel}</span>
              </div>
              <pre className="ai-code-pre">{seg.content}{isStreaming && i === segments.length - 1 && <span className="ai-cursor">▌</span>}</pre>
              {!isStreaming && (
                <button
                  type="button"
                  className="ai-insert-btn"
                  title="Ctrl+U + pegar en terminal (sin Enter)"
                  onClick={() => onInsert(seg.content)}
                >
                  ↵ poner en terminal
                </button>
              )}
            </div>
          )
        }
        return (
          <pre key={i} className="ai-msg-pre">
            {seg.content}
            {isStreaming && i === segments.length - 1 && <span className="ai-cursor">▌</span>}
          </pre>
        )
      })}
    </>
  )
}

interface Props {
  config: AppConfig
  sessionId: string
  /** Texto seleccionado en el terminal (si hay) — se auto-explica al abrir */
  selectedText: string
  /** Callback que devuelve el scrollback fresco en cada petición */
  getTerminalContext: () => string
  /** Ctrl+U + comando en el PTY (misma ruta que teclear en xterm) */
  onInjectLine: (cmd: string) => void
  /** Oculta el panel expandido (la barra con modelo sigue visible) */
  onCollapse: () => void
  /** Panel visible; al pasar a `true` se enfoca el campo de mensaje */
  expanded: boolean
  /** Persistir cambios puntuales de configuración (p. ej. modo agente) */
  onConfigPatch?: (partial: Partial<AppConfig>) => void | Promise<void>
}

export const AiPanel: React.FC<Props> = ({
  config, sessionId, selectedText, getTerminalContext, onInjectLine, onCollapse, expanded, onConfigPatch,
}) => {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [interactionsLog, setInteractionsLog] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [shellPrompt, setShellPrompt] = useState<null | { cmd: string; resolve: (v: boolean) => void }>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  /** Evita solapar peticiones (doble clic / carreras antes de que `loading` se pinte en React). */
  const aiRequestInFlightRef = useRef(false)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const aiInputId = useId()
  /** `null` = primer render; evita enfocar al abrir la app con IA ya expandida */
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
    setShellPrompt(p => {
      if (p) p.resolve(true)
      return null
    })
  }, [])

  const handleShellCancel = useCallback((): void => {
    setShellPrompt(p => {
      if (p) p.resolve(false)
      return null
    })
  }, [])

  /** Tras cada turno completo: pide a Ollama un resumen ≤15 palabras y lo añade al log (persistido). */
  const scheduleInteractionLogUpdate = useCallback((userMsg: string, assistantMsg: string) => {
    void makeInteractionLogEntry(userMsg, assistantMsg, {
      baseURL: config.ollamaBaseURL,
      model: config.defaultModel,
      think: false,
      signal: AbortSignal.timeout(60_000),
    }).then(entry => {
      setInteractionsLog(prev => {
        const next = cappedInteractionsLog(prev, entry)
        window.api.saveInteractionsLog(sessionId, next)
        return next
      })
    })
  }, [config.ollamaBaseURL, config.defaultModel, sessionId])

  /** Tras un turno: segunda llamada a Ollama para decidir si reescribir `.ai-terminal/agent.md`. */
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
          try {
            tree = await window.api.getAgentFolderTree(sessionId)
          } catch {
            tree = '(could not read folder tree)'
          }
          const terminalContext = getTerminalContextRef.current()
          const msgs = buildAgentMdRefreshMessages(
            currentAgentMd,
            tree,
            terminalContext,
            workspace,
            lastUserMessage,
            lastAssistantMessage,
          )
          const raw = await chatOllama(msgs, {
            baseURL: config.ollamaBaseURL,
            model: config.defaultModel,
            signal: AbortSignal.timeout(120_000),
            think: false,
          })
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
    [sessionId, config.ollamaBaseURL, config.defaultModel],
  )

  useEffect(() => {
    if (!expanded) {
      prevExpandedRef.current = false
      return
    }
    if (prevExpandedRef.current === null) {
      prevExpandedRef.current = true
      return
    }
    const wasCollapsed = prevExpandedRef.current === false
    prevExpandedRef.current = true
    if (!wasCollapsed) return
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [expanded])

  const workspaceForPrompt = useCallback(async () => {
    try {
      return await window.api.getProjectAiContext(sessionId)
    } catch {
      return null
    }
  }, [sessionId])

  const ensureAgentMd = useCallback(
    async (
      workspace: ProjectAiContextForAi | null,
      terminalContext: string,
      signal: AbortSignal,
    ): Promise<string | null> => {
      try {
        const existing = await window.api.readAgentMd(sessionId)
        if (existing?.trim()) return existing.trim()
      } catch {
        /* bootstrap */
      }

      let tree = ''
      try {
        tree = await window.api.getAgentFolderTree(sessionId)
      } catch {
        tree = '(could not read folder tree)'
      }

      const bootstrapMsgs = buildAgentMdBootstrapMessages(tree, terminalContext, workspace)
      const generated = await chatOllama(bootstrapMsgs, {
        baseURL: config.ollamaBaseURL,
        model: config.defaultModel,
        signal,
      })
      const body = stripOuterMarkdownFence(generated)
      if (!body.trim()) return null

      try {
        const writeRes = await window.api.writeAgentMd(sessionId, body)
        if (!writeRes.ok) console.error('[agentMd] escritura fallida:', writeRes.error)
      } catch (e) {
        console.error('[agentMd] escritura:', e)
      }
      return body
    },
    [sessionId, config.ollamaBaseURL, config.defaultModel],
  )

  // Cargar historial persistido e interactions log al montar
  useEffect(() => {
    void Promise.all([
      window.api.loadAiChat(sessionId),
      window.api.loadInteractionsLog(sessionId),
    ]).then(([saved, log]) => {
      if (saved.length > 0) {
        setMessages(
          saved
            .filter(
              (e): e is ChatEntry =>
                typeof e?.id === 'string' &&
                (e.role === 'user' || e.role === 'assistant') &&
                typeof e.content === 'string',
            )
            .map(e => ({ ...e, isStreaming: false })),
        )
      }
      if (log.length > 0) {
        setInteractionsLog(
          log.length > MAX_INTERACTIONS_LOG_ENTRIES
            ? log.slice(-MAX_INTERACTIONS_LOG_ENTRIES)
            : log,
        )
      }
      setChatLoaded(true)
    }).catch(() => setChatLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Guardar historial con debounce cuando cambian los mensajes (solo si ya cargó)
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

  // Si hay selección al cargar el chat, auto-explica
  useEffect(() => {
    if (!chatLoaded) return
    if (selectedText.trim()) {
      void runExplain(selectedText)
    }
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

  function addEntry(role: ChatEntry['role'], content: string, isStreaming = false): string {
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
      const agentMd = await ensureAgentMd(
        workspace,
        getTerminalContextRef.current(),
        ctrl.signal,
      )
      const [sysMsg, userMsg] = buildExplainPrompt(
        text,
        getTerminalContextRef.current(),
        workspace,
        agentMd,
        config.agentMode ?? false,
        config.agentShellPolicy ?? 'off',
        interactionsLog,
      )
      const initialMsgs: ChatMessage[] = [sysMsg, ...historyMsgs, userMsg]
      let full = ''
      let thinkingFull = ''
      if (config.agentMode) {
        full = await runChatWithAgentFileLoop(
          initialMsgs,
          sessionId,
          {
            baseURL: config.ollamaBaseURL,
            model: config.defaultModel,
            signal: ctrl.signal,
            shellPolicy: config.agentShellPolicy ?? 'off',
            confirmShell: config.agentShellPolicy === 'ask' ? confirmShell : undefined,
            think: config.thinkingMode ?? false,
            onThinkingToken: tok => {
              thinkingFull += tok
              updateEntryThinking(assistantId, thinkingFull, true)
            },
          },
          visible => updateEntry(assistantId, visible, true),
        )
      } else {
        await chatOllama(initialMsgs, {
          baseURL: config.ollamaBaseURL,
          model: config.defaultModel,
          signal: ctrl.signal,
          think: config.thinkingMode ?? false,
          onThinkingToken: tok => {
            thinkingFull += tok
            updateEntryThinking(assistantId, thinkingFull, true)
          },
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
        setError(`Error connecting to Ollama: ${(e as Error).message}`)
        if (assistantId) updateEntry(assistantId, '_Could not get a response._', false)
      }
    } finally {
      aiRequestInFlightRef.current = false
      setLoading(false)
      if (assistantId) {
        setMessages(prev =>
          prev.map(m => (m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false, thinkingStreaming: false } : m)),
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
      // Capturar historial ANTES de añadir la entrada nueva (React aún no actualizó el estado)
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
      const agentMd = await ensureAgentMd(
        workspace,
        getTerminalContextRef.current(),
        ctrl.signal,
      )
      const systemContent = buildChatSystemPrompt(
        getTerminalContextRef.current(),
        workspace,
        agentMd,
        config.agentMode ?? false,
        config.agentShellPolicy ?? 'off',
        interactionsLog,
      )
      const history: ChatMessage[] = [
        { role: 'system', content: systemContent },
        ...historyMsgs,
        { role: 'user', content: text },
      ]
      let full = ''
      let thinkingFull = ''
      if (config.agentMode) {
        full = await runChatWithAgentFileLoop(
          history,
          sessionId,
          {
            baseURL: config.ollamaBaseURL,
            model: config.defaultModel,
            signal: ctrl.signal,
            shellPolicy: config.agentShellPolicy ?? 'off',
            confirmShell: config.agentShellPolicy === 'ask' ? confirmShell : undefined,
            think: config.thinkingMode ?? false,
            onThinkingToken: tok => {
              thinkingFull += tok
              updateEntryThinking(assistantId, thinkingFull, true)
            },
          },
          visible => updateEntry(assistantId, visible, true),
        )
      } else {
        await chatOllama(history, {
          baseURL: config.ollamaBaseURL,
          model: config.defaultModel,
          signal: ctrl.signal,
          think: config.thinkingMode ?? false,
          onThinkingToken: tok => {
            thinkingFull += tok
            updateEntryThinking(assistantId, thinkingFull, true)
          },
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
        setError(`Error connecting to Ollama: ${(e as Error).message}`)
        if (assistantId) updateEntry(assistantId, '_Could not get a response._', false)
      }
    } finally {
      aiRequestInFlightRef.current = false
      setLoading(false)
      if (assistantId) {
        setMessages(prev =>
          prev.map(m => (m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false, thinkingStreaming: false } : m)),
        )
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  function handleStop(): void {
    abortRef.current?.abort()
    setLoading(false)
  }

  function insertInTerminal(cmd: string): void {
    onInjectLine(cmd)
  }

  function handleDeleteHistory(): void {
    setConfirmingDelete(true)
  }

  function confirmDelete(): void {
    setMessages([])
    setInteractionsLog([])
    setConfirmingDelete(false)
    window.api.deleteAiChat(sessionId)
    window.api.deleteInteractionsLog(sessionId)
  }

  function cancelDelete(): void {
    setConfirmingDelete(false)
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).closest('.ai-panel-agent-toggle')) return
    if ((e.target as HTMLElement).closest('.ai-panel-think-toggle')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCollapse()
    }
  }

  function handleHeaderClick(e: React.MouseEvent<HTMLDivElement>): void {
    const t = e.target as HTMLElement
    if (t.closest('.ai-panel-delete')) return
    if (t.closest('.ai-panel-agent-toggle')) return
    if (t.closest('.ai-panel-think-toggle')) return
    onCollapse()
  }

  return (
    <>
    <div className="ai-panel">
      <div
        className="ai-panel-header ai-panel-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded
        aria-label="Ocultar panel de IA (clic en la barra)"
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="ai-panel-header-main">
          <div className="ai-panel-header-top">
            <div className="ai-panel-title">
              <span className="ai-panel-prompt" aria-hidden="true">#</span>
              <span className="ai-panel-name">ia</span>
              <span className="ai-model-badge">{config.defaultModel}</span>
            </div>
            <div className="ai-panel-actions">
              <button
                type="button"
                role="switch"
                aria-checked={config.agentMode === true}
                aria-label="Modo agente"
                disabled={!onConfigPatch}
                className={`ai-panel-agent-toggle ai-agent-switch${config.agentMode ? ' ai-agent-switch--on' : ''}`}
                title="Modo agente: lectura/escritura de archivos y (según ajustes) ejecución de comandos en el cwd de la sesión."
                onClick={e => {
                  e.stopPropagation()
                  void onConfigPatch?.({ agentMode: !config.agentMode })
                }}
                onKeyDown={e => e.stopPropagation()}
              >
                <span className="ai-agent-switch__track" aria-hidden>
                  <span className="ai-agent-switch__thumb" />
                </span>
                <span className="ai-panel-agent-label">agente</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={config.thinkingMode === true}
                aria-label="Modo thinking"
                disabled={!onConfigPatch}
                className={`ai-panel-think-toggle ai-agent-switch${config.thinkingMode ? ' ai-agent-switch--on' : ''}`}
                title="Modo thinking: el modelo razona internamente antes de responder. Solo funciona con modelos compatibles (qwen3, deepseek-r1, etc.)."
                onClick={e => {
                  e.stopPropagation()
                  void onConfigPatch?.({ thinkingMode: !config.thinkingMode })
                }}
                onKeyDown={e => e.stopPropagation()}
              >
                <span className="ai-agent-switch__track" aria-hidden>
                  <span className="ai-agent-switch__thumb" />
                </span>
                <span className="ai-panel-agent-label">think</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="ai-panel-delete"
                  onClick={e => { e.stopPropagation(); handleDeleteHistory() }}
                  title="Borrar historial"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="ai-panel-tagline">
            Salida lateral del shell: mismo cwd y sesión, otra vía al modelo.
          </p>
        </div>
      </div>

      <div className="ai-messages" ref={messagesScrollRef}>
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <p className="ai-chat-empty-kicker">Puerta al modelo</p>
            <p className="ai-chat-empty-lead">
              Explica salidas, pide comandos o enciende el agente: la IA vive al lado del PTY, sin perder el contexto de esta pestaña.
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`ai-msg ai-msg--${msg.role}`}
            aria-label={msg.role === 'user' ? 'Tu mensaje' : 'Respuesta del modelo'}
          >
            <div className="ai-msg-bubble">
              <div className="ai-msg-content">
                {msg.role === 'assistant'
                  ? <>
                      {msg.thinking && (
                        <ThinkingBlock content={msg.thinking} isStreaming={!!msg.thinkingStreaming} />
                      )}
                      <MsgContent content={msg.content} isStreaming={!!msg.isStreaming} onInsert={insertInTerminal} />
                    </>
                  : (
                  <div className="ai-msg-content-inner ai-msg-content-inner--user">
                    <pre className="ai-msg-pre">{msg.content}{msg.isStreaming && <span className="ai-cursor">▌</span>}</pre>
                  </div>
                    )
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="ai-error" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}

      <div className="ai-input-area">
        <label className="ai-input-shell" htmlFor={aiInputId}>
          <span className="ai-input-prompt" aria-hidden>›</span>
          <textarea
            id={aiInputId}
            ref={inputRef}
            className="ai-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe al modelo… (Enter envía · Shift+Enter línea nueva)"
            rows={1}
            disabled={loading}
          />
        </label>
        <div className="ai-input-actions">
          {loading
            ? <button className="ai-send-btn ai-stop-btn" onClick={handleStop}>Detener</button>
            : <button className="ai-send-btn" onClick={() => void handleSend()} disabled={!input.trim()}>Enviar</button>
          }
        </div>
      </div>
    </div>
    {createPortal(
      <ConfirmTerminalModal
        open={confirmingDelete}
        message="¿Borrar todo el historial de este chat?"
        detail="Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />,
      document.body,
    )}
    {createPortal(
      <ConfirmTerminalModal
        open={shellPrompt !== null}
        zIndex={760}
        message="¿Ejecutar este comando del agente en el cwd de esta sesión?"
        detail={shellPrompt?.cmd}
        onConfirm={handleShellConfirm}
        onCancel={handleShellCancel}
      />,
      document.body,
    )}
    </>
  )
}
