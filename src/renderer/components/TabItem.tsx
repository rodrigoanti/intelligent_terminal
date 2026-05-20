import React, { useCallback, useRef } from 'react'
import type { TabSession } from '../App'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'
import { Spinner } from './ui/Spinner'

interface TabItemProps {
  tab: TabSession
  /** Posición 1-based en la barra (⌘1…⌘9) */
  tabNumber: number
  isActive: boolean
  isDragOver: boolean
  isBusy: boolean
  isEditing: boolean
  editDraft: string
  editInputRef: React.RefObject<HTMLInputElement>
  onSelect: () => void
  onStartEdit: (e: React.MouseEvent) => void
  onEditDraftChange: (value: string) => void
  onEditCommit: () => void
  onEditCancel: () => void
  onClose: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragLeave: () => void
  skipBlurCommitRef: React.RefObject<boolean>
}

export const TabItem: React.FC<TabItemProps> = ({
  tab,
  tabNumber,
  isActive,
  isDragOver,
  isBusy,
  isEditing,
  editDraft,
  editInputRef,
  onSelect,
  onStartEdit,
  onEditDraftChange,
  onEditCommit,
  onEditCancel,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
  skipBlurCommitRef,
}) => {
  const { t } = useT()

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isActive && (e.key === 'Enter' || e.key === ' ')) {
      if (!isEditing) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }, [isActive, isEditing])

  return (
    <div
      className={[
        'tab',
        isActive ? 'tab--active' : '',
        isDragOver ? 'tab--drag-over' : '',
      ].filter(Boolean).join(' ')}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onClick={() => { if (!isEditing) onSelect() }}
      title={isEditing ? undefined : tab.title}
    >
      {isBusy ? (
        <Spinner aria-label={t('tabs.spinnerAriaLabel')} />
      ) : (
        <span className="tab-icon" aria-hidden="true">
          <Icon name="terminal" size={10} />
        </span>
      )}

      {isEditing ? (
        <input
          ref={editInputRef}
          className="tab-title tab-title-input"
          value={editDraft}
          aria-label={t('tabs.tabNameAriaLabel')}
          onChange={e => onEditDraftChange(e.target.value)}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false
              return
            }
            onEditCommit()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onEditCommit() }
            if (e.key === 'Escape') { e.preventDefault(); onEditCancel() }
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
          onClick={isActive ? onStartEdit : undefined}
          onKeyDown={isActive ? handleKeyDown : undefined}
          title={isActive ? t('tabs.tabClickRename') : undefined}
        >
          {tab.title}
        </span>
      )}

      {!isEditing && (
        <span className="tab-number" aria-label={t('tabs.tabAriaLabel', { n: tabNumber })}>
          {tabNumber}
        </span>
      )}

      <TabCloseButton title={t('tabs.closeTabTitle')} onClose={onClose} />
    </div>
  )
}

interface TabCloseButtonProps {
  title: string
  onClose: () => void
}

const TabCloseButton: React.FC<TabCloseButtonProps> = ({ title, onClose }) => (
  <span
    className="tab-close"
    role="button"
    onClick={e => { e.stopPropagation(); onClose() }}
    title={title}
  >
    <Icon name="close" size={10} />
  </span>
)
