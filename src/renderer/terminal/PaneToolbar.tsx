import React from 'react'
import type { DragEvent } from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'

export interface PaneToolbarProps {
  showReorderHandle: boolean
  isGrabbed: boolean
  showClosePane: boolean
  onDragHandleStart: (e: DragEvent) => void
  onDragHandleEnd: () => void
  onClosePane: () => void
  onOpenGitPanel: () => void
  onOpenFolderInFinder: () => void
  onPointerDown: (e: React.MouseEvent) => void
}

export const PaneToolbar: React.FC<PaneToolbarProps> = ({
  showReorderHandle,
  isGrabbed,
  showClosePane,
  onDragHandleStart,
  onDragHandleEnd,
  onClosePane,
  onOpenGitPanel,
  onOpenFolderInFinder,
  onPointerDown,
}) => (
  <div className="pane-toolbar" onMouseDown={onPointerDown}>
    <div className="pane-toolbar__group pane-toolbar__group--start">
      {showReorderHandle && (
        <PaneReorderHandle
          isGrabbed={isGrabbed}
          onDragStart={onDragHandleStart}
          onDragEnd={onDragHandleEnd}
        />
      )}
      <PaneToolbarButton
        icon="git-branch"
        title="Git: estado, pull, commit y push en la carpeta de esta terminal"
        aria-label="Abrir panel Git de esta terminal"
        variant="git"
        onPointerDown={onPointerDown}
        onClick={onOpenGitPanel}
      />
      <PaneToolbarButton
        icon="folder"
        title="Abrir carpeta de esta terminal en el Finder"
        aria-label="Abrir carpeta de esta terminal en el Finder"
        variant="folder"
        onPointerDown={onPointerDown}
        onClick={onOpenFolderInFinder}
      />
    </div>
    {showClosePane && (
      <div className="pane-toolbar__group pane-toolbar__group--end">
        <PaneToolbarButton
          icon="close"
          title="Cerrar este panel"
          aria-label="Cerrar este panel"
          variant="close"
          onPointerDown={onPointerDown}
          onClick={onClosePane}
        />
      </div>
    )}
  </div>
)

interface PaneReorderHandleProps {
  isGrabbed: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}

const PaneReorderHandle: React.FC<PaneReorderHandleProps> = ({
  isGrabbed,
  onDragStart,
  onDragEnd,
}) => (
  <span
    role="button"
    tabIndex={-1}
    draggable
    className="pane-toolbar-reorder-handle terminal-chrome-btn"
    title="Reordenar panel"
    aria-label="Reordenar panel"
    aria-grabbed={isGrabbed}
    onMouseDown={e => { e.stopPropagation() }}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
  >
    <Icon name="drag-handle" size={9} />
  </span>
)

interface PaneToolbarButtonProps {
  icon: IconName
  title: string
  'aria-label'?: string
  variant: 'folder' | 'close' | 'git'
  onPointerDown: (e: React.MouseEvent) => void
  onClick: () => void
}

const PaneToolbarButton: React.FC<PaneToolbarButtonProps> = ({
  icon,
  title,
  'aria-label': ariaLabel,
  variant,
  onPointerDown,
  onClick,
}) => (
  <button
    type="button"
    tabIndex={-1}
    className={`pane-toolbar-btn pane-toolbar-btn--${variant} terminal-chrome-btn`}
    title={title}
    aria-label={ariaLabel ?? title}
    onMouseDown={onPointerDown}
    onClick={onClick}
  >
    <Icon name={icon} size={9} />
  </button>
)
