import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  chatOllama,
  buildExplainPrompt,
  buildChatSystemPrompt,
} from '@ai/ollamaClient'
import type { ChatMessage } from '@ai/ollamaClient'
import type { AppConfig } from '@shared/configSchema'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import './AiPanel.css'

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
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
                <span className="ai-code-dots">
                  <span className="ai-code-dot ai-code-dot--a" />
                  <span className="ai-code-dot ai-code-dot--b" />
                  <span className="ai-code-dot ai-code-dot--c" />
                </span>
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
}

export const AiPanel: React.FC<Props> = ({
  config, sessionId, selectedText, getTerminalContext, onInjectLine, onCollapse, expanded,
}) => {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [chatLoaded, setChatLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** `null` = primer render; evita enfocar al abrir la app con IA ya expandida */
  const prevExpandedRef = useRef<boolean | null>(null)
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getTerminalContextRef = useRef(getTerminalContext)
  getTerminalContextRef.current = getTerminalContext

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

  const readmeCacheRef = useRef<string | undefined>(undefined)
  const readmeForPrompt = useCallback(async (): Promise<string> => {
    if (readmeCacheRef.current !== undefined) return readmeCacheRef.current
    try {
      readmeCacheRef.current = await window.api.getAppReadme()
    } catch {
      readmeCacheRef.current = ''
    }
    return readmeCacheRef.current
  }, [])

  const workspaceForPrompt = useCallback(async () => {
    try {
      return await window.api.getProjectAiContext(sessionId)
    } catch {
      return null
    }
  }, [sessionId])

  // Cargar historial persistido al montar
  useEffect(() => {
    void window.api.loadAiChat(sessionId).then(saved => {
      if (saved.length > 0) {
        setMessages(saved.map(e => ({ ...e, isStreaming: false })))
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
      const toSave = messages.map(({ id, role, content }) => ({ id, role, content }))
      window.api.saveAiChat(sessionId, toSave)
    }, 800)
  }, [messages, chatLoaded, sessionId])

  // Precarga README; si hay selección, auto-explica con terminal + README
  useEffect(() => {
    if (!chatLoaded) return
    void (async () => {
      await readmeForPrompt()
      if (selectedText.trim()) {
        void runExplain(selectedText)
      }
    })()
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

  async function runExplain(text: string): Promise<void> {
    if (loading) return
    const readme = await readmeForPrompt()
    const workspace = await workspaceForPrompt()
    setError(null)
    setLoading(true)
    addEntry('user', `Explicar:\n\`\`\`\n${text.slice(0, 600)}\n\`\`\``)
    const assistantId = addEntry('assistant', '…', true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let full = ''
    try {
      await chatOllama(buildExplainPrompt(text, getTerminalContextRef.current(), readme, workspace), {
        baseURL: config.ollamaBaseURL,
        model: config.defaultModel,
        signal: ctrl.signal,
        onToken: tok => { full += tok; updateEntry(assistantId, full, true) },
      })
      updateEntry(assistantId, full, false)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(`Error conectando con Ollama: ${(e as Error).message}`)
        updateEntry(assistantId, '_Error al obtener respuesta_', false)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (loading) return
    const readme = await readmeForPrompt()
    const workspace = await workspaceForPrompt()
    setError(null)
    setLoading(true)
    addEntry('user', text)
    const assistantId = addEntry('assistant', '…', true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const systemContent = buildChatSystemPrompt(getTerminalContextRef.current(), readme, workspace)
    const history: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages
        .filter(m => !m.isStreaming)
        .map(m => ({ role: m.role, content: m.content }) as ChatMessage),
      { role: 'user', content: text },
    ]
    let full = ''
    try {
      await chatOllama(history, {
        baseURL: config.ollamaBaseURL,
        model: config.defaultModel,
        signal: ctrl.signal,
        onToken: tok => { full += tok; updateEntry(assistantId, full, true) },
      })
      updateEntry(assistantId, full, false)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(`Error conectando con Ollama: ${(e as Error).message}`)
        updateEntry(assistantId, '_Error al obtener respuesta_', false)
      }
    } finally {
      setLoading(false)
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
    setConfirmingDelete(false)
    window.api.deleteAiChat(sessionId)
  }

  function cancelDelete(): void {
    setConfirmingDelete(false)
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCollapse()
    }
  }

  function handleHeaderClick(e: React.MouseEvent<HTMLDivElement>): void {
    const t = e.target as HTMLElement
    if (t.closest('.ai-panel-delete')) return
    onCollapse()
  }

  return (
    <>
    <div className="ai-panel fade-in">
      <div
        className="ai-panel-header ai-panel-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded
        aria-label="Ocultar panel de IA (clic en la barra)"
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="ai-panel-title">
          <span className="ai-panel-prompt" aria-hidden="true">#</span>
          <span>ia</span>
          <span className="ai-model-badge">{config.defaultModel}</span>
        </div>
        <div className="ai-panel-actions">
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

      <div className="ai-messages" ref={messagesScrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`ai-msg ai-msg--${msg.role}`}>
            <div className="ai-msg-content">
              {msg.role === 'assistant'
                ? <MsgContent content={msg.content} isStreaming={!!msg.isStreaming} onInsert={insertInTerminal} />
                : (
                  <div className="ai-msg-content-inner ai-msg-content-inner--user">
                    <span className="ai-msg-user-chevron" aria-hidden="true">❯</span>
                    <pre className="ai-msg-pre">{msg.content}{msg.isStreaming && <span className="ai-cursor">▌</span>}</pre>
                  </div>
                  )
              }
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
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="pregunta… (Enter envía, Shift+Enter nueva línea)"
          rows={1}
          disabled={loading}
        />
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
    </>
  )
}
