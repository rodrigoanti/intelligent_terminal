import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { FileExplorerTreeNode } from './FileExplorerTreeNode'

interface FileExplorerTreeProps {
  sessionId: string
  selectedPath: string | null
  onSelectFile: (relPath: string) => void
}

function sortEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({
  sessionId,
  selectedPath,
  onSelectFile,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))
  const [childrenByDir, setChildrenByDir] = useState<Map<string, FileExplorerEntry[]>>(
    () => new Map(),
  )
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set())

  const loadDir = useCallback(
    async (relPath: string): Promise<void> => {
      setLoadingDirs(prev => new Set(prev).add(relPath))
      try {
        const result = await window.api.fileExplorerListDir(sessionId, relPath)
        setChildrenByDir(prev => {
          const next = new Map(prev)
          next.set(relPath, result.ok ? sortEntries(result.entries) : [])
          return next
        })
      } finally {
        setLoadingDirs(prev => {
          const next = new Set(prev)
          next.delete(relPath)
          return next
        })
      }
    },
    [sessionId],
  )

  useEffect(() => {
    setExpanded(new Set(['']))
    setChildrenByDir(new Map())
    void loadDir('')
  }, [sessionId, loadDir])

  const toggleDir = useCallback(
    (relPath: string): void => {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(relPath)) {
          next.delete(relPath)
        } else {
          next.add(relPath)
          if (!childrenByDir.has(relPath)) {
            void loadDir(relPath)
          }
        }
        return next
      })
    },
    [childrenByDir, loadDir],
  )

  const visibleRows = useMemo(() => {
    const rows: Array<{
      entry: FileExplorerEntry
      depth: number
      expanded: boolean
      loading: boolean
    }> = []

    const walk = (dirPath: string, depth: number): void => {
      const kids = childrenByDir.get(dirPath) ?? []
      for (const entry of kids) {
        const isExp = entry.isDirectory && expanded.has(entry.relPath)
        rows.push({
          entry,
          depth,
          expanded: isExp,
          loading: loadingDirs.has(entry.relPath),
        })
        if (isExp) {
          walk(entry.relPath, depth + 1)
        }
      }
    }

    walk('', 0)
    return rows
  }, [childrenByDir, expanded, loadingDirs])

  return (
    <div className="file-explorer-tree" role="tree">
      {visibleRows.length === 0 && !loadingDirs.has('') && (
        <p className="file-explorer-tree__empty">Carpeta vacía</p>
      )}
      {visibleRows.map(row => (
        <FileExplorerTreeNode
          key={row.entry.relPath}
          entry={row.entry}
          depth={row.depth}
          expanded={row.expanded}
          loading={row.loading}
          selected={selectedPath === row.entry.relPath}
          onToggleDir={toggleDir}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}
