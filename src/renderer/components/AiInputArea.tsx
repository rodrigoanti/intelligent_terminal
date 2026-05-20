import React, { useId } from 'react'
import { useT } from '@i18n/useT'
import { Input } from './ui/Input'

interface AiInputAreaProps {
  value: string
  loading: boolean
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  inputRef: React.RefObject<HTMLInputElement>
}

export const AiInputArea: React.FC<AiInputAreaProps> = ({
  value,
  loading,
  onChange,
  onSend,
  onStop,
  onKeyDown,
  inputRef,
}) => {
  const { t } = useT()
  const inputId = useId()

  return (
    <div className="ai-input-area">
      <label className="ai-input-shell" htmlFor={inputId}>
        <span className="ai-input-prompt" aria-hidden="true">›</span>
        <Input
          id={inputId}
          ref={inputRef}
          variant="inline"
          size="sm"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
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
            onClick={onSend}
            disabled={!value.trim()}
          >
            {t('ai.send')}
          </button>
        )}
      </div>
    </div>
  )
}
