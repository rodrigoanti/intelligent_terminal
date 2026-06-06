import { watch, type FSWatcher } from 'fs'
import { resolve, relative, dirname } from 'path'
import type { BrowserWindow } from 'electron'
import { IPC } from '../src/shared/ipcChannels'

interface WatcherEntry {
  watcher: FSWatcher
  cwd: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  pendingDirs: Set<string>
}

const watchers = new Map<string, WatcherEntry>()

function normalizeRelFromAbs(cwd: string, absPath: string): string {
  const rel = relative(resolve(cwd), absPath).replace(/\\/g, '/')
  if (!rel || rel === '.') return ''
  if (rel.startsWith('..')) return ''
  return rel
}

function parentRelPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

function flushPending(sessionId: string, win: BrowserWindow | null): void {
  const entry = watchers.get(sessionId)
  if (!entry || entry.pendingDirs.size === 0) return
  const dirs = Array.from(entry.pendingDirs)
  entry.pendingDirs.clear()
  entry.debounceTimer = null
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.FILE_EXPLORER_FS_CHANGED, sessionId, dirs)
  }
}

export function startFileExplorerWatch(
  sessionId: string,
  cwdRaw: string,
  win: BrowserWindow | null,
): void {
  stopFileExplorerWatch(sessionId)
  const cwd = resolve(String(cwdRaw).trim())
  let watcher: FSWatcher
  try {
    watcher = watch(cwd, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      const entry = watchers.get(sessionId)
      if (!entry) return
      const abs = resolve(cwd, String(filename))
      const rel = normalizeRelFromAbs(cwd, abs)
      const parent = parentRelPath(rel)
      entry.pendingDirs.add(parent)
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.debounceTimer = setTimeout(() => flushPending(sessionId, win), 300)
    })
  } catch {
    return
  }

  watchers.set(sessionId, {
    watcher,
    cwd,
    debounceTimer: null,
    pendingDirs: new Set(),
  })
}

export function stopFileExplorerWatch(sessionId: string): void {
  const entry = watchers.get(sessionId)
  if (!entry) return
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
  try {
    entry.watcher.close()
  } catch {
    // ignore
  }
  watchers.delete(sessionId)
}

export function stopAllFileExplorerWatches(): void {
  for (const sessionId of Array.from(watchers.keys())) {
    stopFileExplorerWatch(sessionId)
  }
}
