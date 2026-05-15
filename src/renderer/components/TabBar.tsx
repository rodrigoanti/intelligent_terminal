import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { TabSession } from '../App'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import './TabBar.css'

interface Props {
  tabs: TabSession[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onReorder: (dragId: string, dropId: string) => void
  busyTabIds: Set<string>
}

export const TabBar: React.FC<Props> = ({
  tabs, activeTabId, onSelect, onAdd, onClose, onRename, onReorder, busyTabIds,
}) => {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [closeTabConfirm, setCloseTabConfirm] = useState<{ id: string; title: string } | null>(null)
  const inlineRenameRef = useRef<HTMLInputElement>(null)
  /** Evita que blur confirme justo después de Escape (mismo tick). */
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    if (!editingTabId) return
    const el = inlineRenameRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editingTabId])

  const beginEditTab = useCallback((tab: TabSession): void => {
    onSelect(tab.id)
    setEditingTabId(tab.id)
    setEditDraft(tab.title)
  }, [onSelect])

  const startEditingTitle = (e: React.MouseEvent, tab: TabSession): void => {
    e.preventDefault()
    e.stopPropagation()
    beginEditTab(tab)
  }

  const commitInlineRename = (): void => {
    if (!editingTabId) return
    const id = editingTabId
    const next = editDraft.trim()
    setEditingTabId(null)
    if (next) onRename(id, next)
  }

  const cancelInlineRename = (): void => {
    skipBlurCommitRef.current = true
    setEditingTabId(null)
  }

  return (
    <>
      <div className="tabbar">
        <div className="tabbar-scroll">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            const isDragOver = dragOverId === tab.id && dragId !== tab.id
            const isEditing = editingTabId === tab.id
            return (
              <div
                key={tab.id}
                className={[
                  'tab',
                  isActive ? 'tab--active' : '',
                  isDragOver ? 'tab--drag-over' : '',
                ].filter(Boolean).join(' ')}
                draggable={!isEditing}
                onDragStart={e => {
                  if (editingTabId) {
                    e.preventDefault()
                    return
                  }
                  setDragId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={e => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverId !== tab.id) setDragOverId(tab.id)
                }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragId && dragId !== tab.id) onReorder(dragId, tab.id)
                  setDragId(null)
                  setDragOverId(null)
                }}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                onDragLeave={() => { if (dragOverId === tab.id) setDragOverId(null) }}
                onClick={() => { if (!isEditing) onSelect(tab.id) }}
                title={isEditing ? undefined : tab.title}
              >
                {/* Terminal icon / spinner de actividad */}
                {busyTabIds.has(tab.id) ? (
                  <span className="tab-spinner" aria-label="Ejecutando" aria-hidden="true" />
                ) : (
                  <span className="tab-icon">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="4 17 10 11 4 5"/>
                      <line x1="12" y1="19" x2="20" y2="19"/>
                    </svg>
                  </span>
                )}

                {/* Title — clic para editar en línea */}
                {isEditing ? (
                  <input
                    ref={inlineRenameRef}
                    className="tab-title tab-title-input"
                    value={editDraft}
                    aria-label="Nombre de la pestaña"
                    onChange={e => setEditDraft(e.target.value)}
                    onBlur={() => {
                      if (skipBlurCommitRef.current) {
                        skipBlurCommitRef.current = false
                        return
                      }
                      commitInlineRename()
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitInlineRename()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelInlineRename()
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    spellCheck={false}
                    maxLength={40}
                  />
                ) : (
                  <span
                    className={['tab-title', isActive ? 'tab-title--editable' : ''].filter(Boolean).join(' ')}
                    role={isActive ? 'button' : undefined}
                    tabIndex={isActive ? 0 : undefined}
                    onClick={isActive ? e => startEditingTitle(e, tab) : undefined}
                    onKeyDown={isActive ? e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        beginEditTab(tab)
                      }
                    } : undefined}
                    title={isActive ? 'Clic para renombrar' : undefined}
                  >
                    {tab.title}
                  </span>
                )}

                {/* Close button */}
                <span
                  className="tab-close"
                  role="button"
                  onClick={e => { e.stopPropagation(); setCloseTabConfirm({ id: tab.id, title: tab.title }) }}
                  title="Cerrar pestaña"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </span>
              </div>
            )
          })}
        </div>

        <button className="tab-add" type="button" onClick={onAdd} title="Nueva pestaña (⌘T)" aria-label="Nueva pestaña">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <ConfirmTerminalModal
        open={closeTabConfirm !== null}
        message={closeTabConfirm ? `¿Cerrar pestaña «${closeTabConfirm.title}»?` : ''}
        detail="Se cerrarán todos los paneles de esta pestaña y sus sesiones."
        onConfirm={() => {
          if (closeTabConfirm) onClose(closeTabConfirm.id)
          setCloseTabConfirm(null)
        }}
        onCancel={() => setCloseTabConfirm(null)}
      />
    </>
  )
}
