import React, { useId, useRef, useState, useCallback } from 'react'
import { useT } from '@i18n/useT'
import { Input } from './ui/Input'
import { AiFileMentionPopup } from './AiFileMentionPopup'
import type { MentionedFile } from '@ai/ollamaClient'

interface AiInputAreaProps {
  value: string
  loading: boolean
  /** ID de sesión PTY, necesario para resolver @menciones vía window.api. */
  sessionId: string
  /** Lista de archivos disponibles para @mention (rutas relativas al cwd). */
  availableFiles: string[]
  /** Llamado la primera vez que el usuario escribe @ para cargar la lista de archivos. */
  onRequestFiles: () => void
  onChange: (value: string) => void
  onSend: (mentionedFiles: MentionedFile[]) => void
  onStop: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  inputRef: React.RefObject<HTMLInputElement>
}

/** Extrae el prefijo de @mención activa en el cursor, si existe. Devuelve null si no hay mención abierta. */
function getActiveMentionPrefix(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos)
  const atIdx = before.lastIndexOf('@')
  if (atIdx === -1) return null
  // Si hay un espacio entre @ y el cursor, la mención ya terminó
  const fragment = before.slice(atIdx + 1)
  if (fragment.includes(' ')) return null
  return fragment
}

/** Reemplaza el texto de la mención activa con la ruta seleccionada. */
function replaceMention(value: string, cursorPos: number, selectedPath: string): string {
  const before = value.slice(0, cursorPos)
  const atIdx = before.lastIndexOf('@')
  if (atIdx === -1) return value
  const after = value.slice(cursorPos)
  return `${value.slice(0, atIdx)}@${selectedPath} ${after}`
}

/** Parsea todas las @menciones completas del texto. */
function parseMentions(text: string): string[] {
  const regex = /@([\w./\-]+)/g
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1])
  }
  return matches
}

export const AiInputArea: React.FC<AiInputAreaProps> = ({
  value,
  loading,
  sessionId,
  availableFiles,
  onRequestFiles,
  onChange,
  onSend,
  onStop,
  onKeyDown,
  inputRef,
}) => {
  const { t } = useT()
  const inputId = useId()
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const mentionedFilesRef = useRef<MentionedFile[]>([])

  const handleChange = useCallback((newValue: string): void => {
    onChange(newValue)
    const cursor = inputRef.current?.selectionStart ?? newValue.length
    const query = getActiveMentionPrefix(newValue, cursor)
    // Carga la lista de archivos la primera vez que el usuario escribe @
    if (query !== null) onRequestFiles()
    setMentionQuery(query)
  }, [onChange, inputRef, onRequestFiles])

  const handleSelectMention = useCallback((path: string): void => {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const newValue = replaceMention(value, cursor, path)
    onChange(newValue)
    setMentionQuery(null)
    // Re-enfocar input y mover cursor al final de la mención insertada
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const newCursor = newValue.indexOf(`@${path}`) + path.length + 2
      el.setSelectionRange(newCursor, newCursor)
    })
  }, [value, onChange, inputRef])

  const handleSendWithMentions = useCallback(async (): Promise<void> => {
    const mentions = parseMentions(value)
    if (mentions.length === 0) {
      onSend([])
      return
    }
    // Resuelve los archivos mencionados antes de enviar
    const resolved: MentionedFile[] = []
    for (const path of mentions) {
      try {
        // Busca la ruta en availableFiles (tolerante a mayúsculas)
        const matched = availableFiles.find(f => f.toLowerCase() === path.toLowerCase()) ?? path
        const r = await window.api.agentReadFile(sessionId, matched)
        if (r.ok && r.content !== undefined) {
          resolved.push({ path: matched, content: r.content })
        }
      } catch {
        /* skip unresolvable mentions */
      }
    }
    onSend(resolved)
  }, [value, availableFiles, onSend])

  const handleKeyDownWithMention = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Si hay popup activo, las teclas de navegación se gestionan en el popup
    if (mentionQuery !== null && ['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendWithMentions()
      return
    }
    onKeyDown(e)
  }, [mentionQuery, handleSendWithMentions, onKeyDown])

  return (
    <div className="ai-input-area" style={{ position: 'relative' }}>
      {mentionQuery !== null && (
        <AiFileMentionPopup
          files={availableFiles}
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setMentionQuery(null)}
        />
      )}
      <label className="ai-input-shell" htmlFor={inputId}>
        <span className="ai-input-prompt" aria-hidden="true">›</span>
        <Input
          id={inputId}
          ref={inputRef}
          variant="inline"
          size="sm"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDownWithMention}
          placeholder={t('ai.inputPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={loading}
        />
      </label>
      <div className="ai-input-actions">
        {loading ? (
          <button type="button" className="ai-send-btn ai-stop-btn" onClick={onStop}>
            {t('ai.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="ai-send-btn"
            onClick={() => void handleSendWithMentions()}
            disabled={!value.trim()}
          >
            {t('ai.send')}
          </button>
        )}
      </div>
    </div>
  )
}
