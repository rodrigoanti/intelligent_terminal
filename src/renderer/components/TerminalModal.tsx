import React, { useEffect } from 'react'
import './TerminalModal.css'

export type TerminalModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface TerminalModalProps {
  open: boolean
  onClose: () => void
  /** Encabezado; si se omite, no se muestra barra superior */
  title?: React.ReactNode
  titleId?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: TerminalModalSize
  /** Por defecto 640; confirmaciones históricas usan 600 */
  zIndex?: number
  closeOnEscape?: boolean
  /** Clic en el fondo oscuro; por defecto no cierra (usar ✕, Esc si aplica, o botones del pie). */
  closeOnBackdrop?: boolean
  /** Botón ✕ en la esquina del encabezado (solo si hay `title`) */
  showHeaderClose?: boolean
  panelClassName?: string
  bodyClassName?: string
}

/**
 * Contenedor común para modales estilo terminal: backdrop, panel, tipografía mono.
 * El fondo no cierra el modal por defecto; se puede activar con `closeOnBackdrop`.
 */
export const TerminalModal: React.FC<TerminalModalProps> = ({
  open,
  onClose,
  title,
  titleId = 'terminal-modal-title',
  children,
  footer,
  size = 'md',
  zIndex = 640,
  closeOnEscape = true,
  closeOnBackdrop = false,
  showHeaderClose = true,
  panelClassName = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeOnEscape, onClose])

  if (!open) return null

  const hasHeader = title != null && title !== ''

  return (
    <div
      className="terminal-modal-backdrop"
      style={{ zIndex }}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={[
          'terminal-modal-panel',
          `terminal-modal-panel--${size}`,
          panelClassName,
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasHeader ? titleId : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {hasHeader && (
          <header className="terminal-modal-header">
            <h2 className="terminal-modal-title" id={titleId}>{title}</h2>
            {showHeaderClose && (
              <button type="button" className="terminal-modal-header-close" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </header>
        )}
        <div className={['terminal-modal-body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
        {footer != null && footer !== false && (
          <footer className="terminal-modal-footer">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
