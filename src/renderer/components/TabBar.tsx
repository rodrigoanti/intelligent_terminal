import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { TabSession } from '../App'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { TabItem } from './TabItem'
import { TabAddButton } from './TabAddButton'
import { buildTabDragThumbnail } from '../dragThumbnailUtils'
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

/** Expuesto a `App` para que ⌘W use el mismo modal que la cruz de la pestaña. */
export interface TabBarHandle {
  requestCloseTab: (tabId: string) => void
}

export const TabBar = forwardRef<TabBarHandle, Props>(function TabBar({
  tabs, activeTabId, onSelect, onAdd, onClose, onRename, onReorder, busyTabIds,
}, ref) {
  const { t } = useT()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [closeTabConfirm, setCloseTabConfirm] = useState<{ id: string; title: string } | null>(null)
  const inlineRenameRef = useRef<HTMLInputElement>(null)
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

  const commitInlineRename = useCallback((): void => {
    if (!editingTabId) return
    const id = editingTabId
    const next = editDraft.trim()
    setEditingTabId(null)
    if (next) onRename(id, next)
  }, [editingTabId, editDraft, onRename])

  const cancelInlineRename = useCallback((): void => {
    skipBlurCommitRef.current = true
    setEditingTabId(null)
  }, [])

  useImperativeHandle(ref, () => ({
    requestCloseTab: (tabId: string): void => {
      const match = tabs.find(t => t.id === tabId)
      if (match) setCloseTabConfirm({ id: match.id, title: match.title })
    },
  }), [tabs])

  return (
    <>
      <div className="tabbar">
        <div className="tabbar-scroll">
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              tabNumber={index + 1}
              isActive={tab.id === activeTabId}
              isDragOver={dragOverId === tab.id && dragId !== tab.id}
              isBusy={busyTabIds.has(tab.id)}
              isEditing={editingTabId === tab.id}
              editDraft={editDraft}
              editInputRef={inlineRenameRef}
              skipBlurCommitRef={skipBlurCommitRef}
              onSelect={() => onSelect(tab.id)}
              onStartEdit={e => {
                e.preventDefault()
                e.stopPropagation()
                beginEditTab(tab)
              }}
              onEditDraftChange={setEditDraft}
              onEditCommit={commitInlineRename}
              onEditCancel={cancelInlineRename}
              onClose={() => setCloseTabConfirm({ id: tab.id, title: tab.title })}
              onDragStart={e => {
                if (editingTabId) { e.preventDefault(); return }
                setDragId(tab.id)
                e.dataTransfer.effectAllowed = 'move'
                const tabEl = e.currentTarget as HTMLElement
                const thumb = buildTabDragThumbnail(tabEl)
                document.body.appendChild(thumb)
                e.dataTransfer.setDragImage(
                  thumb,
                  tabEl.offsetWidth / 2,
                  tabEl.offsetHeight / 2,
                )
                requestAnimationFrame(() => { document.body.removeChild(thumb) })
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
            />
          ))}
        </div>
        <TabAddButton onClick={onAdd} />
      </div>

      <ConfirmTerminalModal
        open={closeTabConfirm !== null}
        message={closeTabConfirm ? t('tabs.confirmCloseMessage', { title: closeTabConfirm.title }) : ''}
        detail={t('tabs.confirmCloseDetail')}
        onConfirm={() => {
          if (closeTabConfirm) onClose(closeTabConfirm.id)
          setCloseTabConfirm(null)
        }}
        onCancel={() => setCloseTabConfirm(null)}
      />
    </>
  )
})
