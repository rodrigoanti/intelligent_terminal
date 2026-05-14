import React, { useCallback, useEffect } from 'react'
import { TerminalModal } from './TerminalModal'
import './ConfirmTerminalModal.css'

interface Props {
  open: boolean
  /** Línea principal (ej. pregunta) */
  message: string
  /** Texto secundario opcional */
  detail?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmación estilo consola: Enter o clic en OK confirma; Esc o backdrop cancelan (vía TerminalModal).
 */
export const ConfirmTerminalModal: React.FC<Props> = ({
  open, message, detail, onConfirm, onCancel,
}) => {
  const confirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, confirm])

  return (
    <TerminalModal
      open={open}
      onClose={onCancel}
      size="sm"
      zIndex={600}
      showHeaderClose={false}
      closeOnEscape
      closeOnBackdrop
      footer={
        <div className="confirm-terminal-actions">
          <button type="button" className="confirm-terminal-no" onClick={onCancel}>
            esc no
          </button>
          <button type="button" className="confirm-terminal-ok" onClick={confirm} autoFocus>
            [enter] OK
          </button>
        </div>
      }
    >
      <p id="confirm-terminal-msg" className="confirm-terminal-message">{message}</p>
      {detail && <p className="confirm-terminal-detail">{detail}</p>}
    </TerminalModal>
  )
}
