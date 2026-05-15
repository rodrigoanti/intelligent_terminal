import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  accessSync,
  constants,
  statSync,
} from 'fs'
import { join, normalize, resolve } from 'path'
import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
} from 'electron'
import * as pty from 'node-pty'
import { IPC } from '@shared/ipcChannels'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '@shared/configSchema'
import type { PersistedSession } from './persistence'
import {
  loadSession,
  saveSession,
  loadAiChat,
  saveAiChat,
  deleteAiChat,
  loadCmdHistory,
  saveCmdHistory,
  deleteCmdHistory,
  loadScrollback,
  saveScrollback,
  deleteScrollback,
  loadInteractionsLog,
  saveInteractionsLog,
  deleteInteractionsLog,
} from './persistence'
import { gatherProjectAiContextForCwd } from './projectAiContext'
import { readAgentMdForCwd, writeAgentMdForCwd, gatherShallowFolderTree } from './agentMd'
import { readProjectFile, writeProjectFile } from './agentFileOps'
import { runAgentShellCommand } from './agentShellOps'
import { readCdRecentFolders } from './cdRecentMd'
import {
  clearSessionCdState,
  ensureSessionCdState,
  getSessionCwd,
  initSessionCwd,
  recordCdFromUserLine,
} from './cdRecentCapture'

function preloadPath(): string {
  return join(__dirname, '../preload/preload.js')
}

function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) return CONFIG_DEFAULTS
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return CONFIG_DEFAULTS
  }
}

function writeConfig(cfg: AppConfig): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}

function projectRootForSession(sessionId: string): string {
  const home = app.getPath('home')
  ensureSessionCdState(sessionId, home)
  return getSessionCwd(sessionId) ?? home
}

interface PtyEntry {
  proc: pty.IPty
  windowId: number
}

const ptySessions = new Map<string, PtyEntry>()

/** true tras ⌘Q / Salir / `app.quit()`. En macOS, si `close` hace `preventDefault()`, Electron cancela ese quit; al destruir la ventana a mano hay que volver a salir aquí. */
let userRequestedAppQuit = false
app.on('before-quit', () => {
  userRequestedAppQuit = true
})

function sendToWindow(windowId: number, channel: string, ...args: unknown[]): void {
  const w = BrowserWindow.getAllWindows().find(b => !b.isDestroyed() && b.id === windowId)
  if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
}

function killPty(sessionId: string): void {
  const entry = ptySessions.get(sessionId)
  if (!entry) return
  try {
    entry.proc.kill()
  } catch {
    /* ignore */
  }
  ptySessions.delete(sessionId)
  clearSessionCdState(sessionId)
}

function resolveShellPath(): string {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(
    (p): p is string => Boolean(p && p.trim()),
  )
  for (const p of candidates) {
    try {
      accessSync(p, constants.X_OK)
      return p
    } catch {
      continue
    }
  }
  return '/bin/zsh'
}

function resolveSpawnCwd(requested: unknown, home: string): string {
  if (typeof requested !== 'string' || !requested.trim()) return home
  try {
    const dir = normalize(resolve(requested.trim()))
    const st = statSync(dir)
    if (!st.isDirectory()) return home
    return dir
  } catch {
    return home
  }
}

/** PNG en `build/icon.png` (electron-builder). Opcional en dev. */
function resolveOptionalWindowIcon(): string | undefined {
  const png = join(__dirname, '../../build/icon.png')
  try {
    if (existsSync(png)) return png
  } catch {
    /* ignore */
  }
  return undefined
}

function registerIpc(): void {
  ipcMain.handle(IPC.CONFIG_GET, (): AppConfig => readConfig())

  ipcMain.handle(IPC.CONFIG_SET, (_e, partial: Partial<AppConfig>) => {
    const next = mergeWithDefaults({ ...readConfig(), ...partial })
    const errs = validateConfig(next)
    if (errs.length) return { ok: false as const, errors: errs }
    writeConfig(next)
    return { ok: true as const }
  })

  ipcMain.on(IPC.CONFIG_OPEN_FOLDER, () => {
    void shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle(IPC.CD_RECENT_LIST, (): string[] => readCdRecentFolders())

  ipcMain.on(IPC.CD_RECENT_RECORD_LINE, (_e, sessionId: string, line: string) => {
    recordCdFromUserLine(sessionId, line, app.getPath('home'))
  })

  ipcMain.handle(IPC.GET_SESSION_CWD, (_e, sessionId: string): string => {
    return getSessionCwd(sessionId) ?? ''
  })

  ipcMain.handle(IPC.LIST_CWD_DIRS, (_e, sessionId: string): string[] => {
    const cwd = projectRootForSession(sessionId)
    try {
      return readdirSync(cwd, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => `${d.name}/`)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    } catch {
      return []
    }
  })

  ipcMain.on(IPC.OPEN_FOLDER, (_e, folderPath: string) => {
    void shell.openPath(folderPath)
  })

  ipcMain.handle(IPC.PROJECT_AI_CONTEXT_GET, (_e, sessionId: string) => {
    return gatherProjectAiContextForCwd(projectRootForSession(sessionId))
  })

  ipcMain.handle(IPC.AGENT_MD_READ, (_e, sessionId: string) => {
    return readAgentMdForCwd(projectRootForSession(sessionId))
  })

  ipcMain.handle(IPC.AGENT_MD_WRITE, (_e, sessionId: string, content: string) => {
    return writeAgentMdForCwd(projectRootForSession(sessionId), content)
  })

  ipcMain.handle(IPC.AGENT_MD_TREE, (_e, sessionId: string): string => {
    return gatherShallowFolderTree(projectRootForSession(sessionId))
  })

  ipcMain.handle(IPC.AGENT_FILE_READ, (_e, sessionId: string, relPath: string) => {
    return readProjectFile(projectRootForSession(sessionId), relPath)
  })

  ipcMain.handle(IPC.AGENT_FILE_WRITE, (_e, sessionId: string, relPath: string, content: string) => {
    return writeProjectFile(projectRootForSession(sessionId), relPath, content)
  })

  ipcMain.handle(IPC.AGENT_SHELL_RUN, (_e, sessionId: string, command: string) => {
    return runAgentShellCommand(projectRootForSession(sessionId), command)
  })

  ipcMain.handle(IPC.SESSION_LOAD, (): PersistedSession | null => loadSession())

  ipcMain.handle(IPC.SESSION_SAVE, (_e, data: PersistedSession) => {
    saveSession(data)
  })

  ipcMain.handle(IPC.AI_CHAT_LOAD, (_e, paneId: string) => loadAiChat(paneId))
  ipcMain.on(IPC.AI_CHAT_SAVE, (_e, paneId: string, entries: unknown) => {
    saveAiChat(paneId, entries as Parameters<typeof saveAiChat>[1])
  })
  ipcMain.on(IPC.AI_CHAT_DELETE, (_e, paneId: string) => {
    deleteAiChat(paneId)
  })

  ipcMain.handle(IPC.CMD_HISTORY_LOAD, (_e, paneId: string) => loadCmdHistory(paneId))
  ipcMain.on(IPC.CMD_HISTORY_SAVE, (_e, paneId: string, lines: unknown) => {
    saveCmdHistory(paneId, lines as string[])
  })
  ipcMain.on(IPC.CMD_HISTORY_DELETE, (_e, paneId: string) => {
    deleteCmdHistory(paneId)
  })

  ipcMain.handle(IPC.SCROLLBACK_LOAD, (_e, paneId: string) => loadScrollback(paneId))
  ipcMain.on(IPC.SCROLLBACK_SAVE, (_e, paneId: string, data: string) => {
    saveScrollback(paneId, data)
  })
  ipcMain.on(IPC.SCROLLBACK_DELETE, (_e, paneId: string) => {
    deleteScrollback(paneId)
  })

  ipcMain.handle(IPC.INTERACTIONS_LOG_LOAD, (_e, paneId: string) => loadInteractionsLog(paneId))
  ipcMain.on(IPC.INTERACTIONS_LOG_SAVE, (_e, paneId: string, entries: unknown) => {
    saveInteractionsLog(paneId, entries as string[])
  })
  ipcMain.on(IPC.INTERACTIONS_LOG_DELETE, (_e, paneId: string) => {
    deleteInteractionsLog(paneId)
  })

  ipcMain.on(IPC.PTY_CREATE, (event, sessionId: string, cwd?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    killPty(sessionId)
    const home = app.getPath('home')
    const initialCwd = resolveSpawnCwd(cwd, home)
    ensureSessionCdState(sessionId, home)
    initSessionCwd(sessionId, initialCwd)

    const shellPath =
      process.platform === 'win32'
        ? process.env.ComSpec || 'cmd.exe'
        : resolveShellPath()
    const shellArgs = process.platform === 'win32' ? [] : ['-l']

    try {
      const proc = pty.spawn(shellPath, shellArgs, {
        name: 'xterm-256color',
        cwd: initialCwd,
        env:
          process.platform === 'win32'
            ? (process.env as NodeJS.ProcessEnv)
            : ({
                ...process.env,
                HOME: home,
                SHELL: shellPath,
                TERM: 'xterm-256color',
                TERM_PROGRAM: 'AI Terminal',
              } as Record<string, string>),
      })
      const windowId = win.id
      ptySessions.set(sessionId, { proc, windowId })

      proc.onData(data => {
        sendToWindow(windowId, IPC.PTY_DATA, sessionId, data)
      })
      proc.onExit(({ exitCode }) => {
        ptySessions.delete(sessionId)
        clearSessionCdState(sessionId)
        sendToWindow(windowId, IPC.PTY_EXIT, sessionId, exitCode)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendToWindow(win.id, IPC.PTY_ERROR, sessionId, msg)
    }
  })

  ipcMain.on(IPC.PTY_WRITE, (_e, sessionId: string, data: string) => {
    ptySessions.get(sessionId)?.proc.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_e, sessionId: string, cols: number, rows: number) => {
    const entry = ptySessions.get(sessionId)
    if (entry) {
      try {
        entry.proc.resize(Math.max(1, cols), Math.max(1, rows))
      } catch {
        /* ignore */
      }
    }
  })

  ipcMain.on(IPC.PTY_KILL, (_e, sessionId: string) => {
    killPty(sessionId)
  })
}

function createWindow(): BrowserWindow {
  const icon = resolveOptionalWindowIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    ...(icon ? { icon } : {}),
    backgroundColor: '#0d0d14',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 },
          // Sin vibrancy: con `under-window` + canvas (xterm) en Chromium/Electron a veces
          // el lienzo deja de repintar y no se ve lo que tecleas aunque el PTY sí recibe datos.
        }
      : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (win.webContents.isDevToolsFocused()) return
    const accel = process.platform === 'darwin' ? input.meta : input.control
    if (!accel || input.alt || input.shift) return
    const k = input.key.toLowerCase()
    if (k !== 'w' && input.code !== 'KeyW') return
    event.preventDefault()
    if (!win.isDestroyed()) win.webContents.send(IPC.SHORTCUT_CLOSE_TAB)
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(devUrl)
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1' || process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools()
    }
  } else {
    void win.loadFile(rendererHtmlPath())
  }

  let closingFromReady = false
  win.on('close', e => {
    if (closingFromReady) return
    e.preventDefault()
    win.webContents.send(IPC.APP_SAVE_BEFORE_CLOSE)

    const timeout = setTimeout(() => {
      closingFromReady = true
      win.destroy()
    }, 2_000)

    ipcMain.once(IPC.APP_CLOSE_READY, (_ev, scrollbacks: unknown) => {
      clearTimeout(timeout)
      if (scrollbacks && typeof scrollbacks === 'object') {
        for (const [paneId, data] of Object.entries(scrollbacks as Record<string, string>)) {
          if (typeof data === 'string' && data.length) saveScrollback(paneId, data)
        }
      }
      closingFromReady = true
      win.destroy()
    })
  })

  win.on('closed', () => {
    for (const id of [...ptySessions.keys()]) killPty(id)
  })

  return win
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  } else if (userRequestedAppQuit) {
    app.quit()
  }
})
