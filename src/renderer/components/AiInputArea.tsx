import React, { useId, useRef, useState, useCallback, useEffect } from 'react'
import { useT } from '@i18n/useT'
import { AiFileMentionPopup } from './AiFileMentionPopup'
import type { MentionedFile } from '@ai/ollamaClient'

const MAX_INPUT_ROWS = 6
const MIN_INPUT_ROWS = 1

interface AiInputAreaProps {
  value: string
  loading: boolean
  sessionId: string
  availableFiles: string[]
  onRequestFiles: () => void
  onChange: (value: string) => void
  onSend: (mentionedFiles: MentionedFile[]) => void
  onStop: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
}

function getActiveMentionPrefix(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos)
  const atIdx = before.lastIndexOf('@')
  if (atIdx === -1) return null
  const fragment = before.slice(atIdx + 1)
  if (fragment.includes(' ') || fragment.includes('\n')) return null
  return fragment
}

function replaceMention(value: string, cursorPos: number, selectedPath: string): string {
  const before = value.slice(0, cursorPos)
  const atIdx = before.lastIndexOf('@')
  if (atIdx === -1) return value
  const after = value.slice(cursorPos)
  return `${value.slice(0, atIdx)}@${selectedPath} ${after}`
}

function parseMentions(text: string): string[] {
  const regex = /@([\w./\-]+)/g
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1])
  }
  return matches
}

function resizeTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18
  const maxH = lineHeight * MAX_INPUT_ROWS + 12
  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
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

  useEffect(() => {
    const el = inputRef.current
    if (el) resizeTextarea(el)
  }, [value, inputRef])

  const handleChange = useCallback((newValue: string): void => {
    onChange(newValue)
    const cursor = inputRef.current?.selectionStart ?? newValue.length
    const query = getActiveMentionPrefix(newValue, cursor)
    if (query !== null) onRequestFiles()
    setMentionQuery(query)
    requestAnimationFrame(() => {
      if (inputRef.current) resizeTextarea(inputRef.current)
    })
  }, [onChange, inputRef, onRequestFiles])

  const handleSelectMention = useCallback((path: string): void => {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const newValue = replaceMention(value, cursor, path)
    onChange(newValue)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const newCursor = newValue.indexOf(`@${path}`) + path.length + 2
      el.setSelectionRange(newCursor, newCursor)
      resizeTextarea(el)
    })
  }, [value, onChange, inputRef])

  const handleSendWithMentions = useCallback(async (): Promise<void> => {
    const mentions = parseMentions(value)
    if (mentions.length === 0) {
      onSend([])
      return
    }
    const resolved: MentionedFile[] = []
    for (const path of mentions) {
      try {
        const matched = availableFiles.find(f => f.toLowerCase() === path.toLowerCase()) ?? path
        const r = await window.api.agentReadFile(sessionId, matched)
        if (r.ok && r.content !== undefined) {
          resolved.push({ path: matched, content: r.content })
        }
      } catch { /* skip */ }
    }
    onSend(resolved)
  }, [value, availableFiles, onSend, sessionId])

  const handleKeyDownWithMention = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mentionQuery !== null && ['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendWithMentions()
      return
    }
    onKeyDown(e)
  }, [mentionQuery, handleSendWithMentions, onKeyDown])

  return (
    <div className="ai-input-area">
      {mentionQuery !== null && (
        <AiFileMentionPopup
          files={availableFiles}
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setMentionQuery(null)}
        />
      )}
      <div className="ai-input-card">
        <label className="ai-input-shell" htmlFor={inputId}>
          <span className="ai-input-prompt" aria-hidden="true">›</span>
          <textarea
            id={inputId}
            ref={inputRef}
            className="ai-input"
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDownWithMention}
            placeholder={t('ai.inputPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            rows={MIN_INPUT_ROWS}
            disabled={loading}
          />
        </label>
        <div className="ai-input-actions">
          {loading ? (
            <button
              type="button"
              className="ai-send-btn ai-send-btn--stop"
              onClick={onStop}
              title={t('ai.stop')}
            >
              <span className="ai-send-btn__icon" aria-hidden="true">■</span>
              <span className="ai-send-btn__label">{t('ai.stop')}</span>
            </button>
          ) : (
            <button
              type="button"
              className="ai-send-btn ai-send-btn--primary"
              onClick={() => void handleSendWithMentions()}
              disabled={!value.trim()}
              title={t('ai.send')}
            >
              <span className="ai-send-btn__icon" aria-hidden="true">↑</span>
              <span className="ai-send-btn__label">{t('ai.send')}</span>
            </button>
          )}
        </div>
      </div>
      <p className="ai-input-hint">{t('ai.inputHint')}</p>
    </div>
  )
}
