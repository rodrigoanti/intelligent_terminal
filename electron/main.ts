import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname, normalize, resolve } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, accessSync, constants, statSync, readdirSync } from 'fs'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import type { AppConfig } from '../src/shared/configSchema'
import { mergeWithDefaults, validateConfig } from '../src/shared/configSchema'
import { IPC } from '../src/shared/ipcChannels'
import {
  ensureSessionCdState,
  clearSessionCdState,
  recordCdFromUserLine,
  getSessionCwd,
  initSessionCwd,
} from './cdRecentCapture'
import { readCdRecentFolders } from './cdRecentMd'
import { gatherProjectAiContextForCwd } from './projectAiContext'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import {
  loadSession, saveSession,
  loadAiChat, saveAiChat, deleteAiChat,
  loadCmdHistory, saveCmdHistory, deleteCmdHistory,
  loadScrollback, saveScrollback, deleteScrollback,
} from './persistence'
import type { PersistedSession, ChatEntry } from './persistence'

// ─── Config ─────────────────────────────────────────────────────────────────

const USER_DATA = app.getPath('userData')
const CONFIG_PATH = join(USER_DATA, 'config.json')

function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8')
      return mergeWithDefaults(JSON.parse(raw))
    }
  } catch {
    // archivo corrupto o inaccesible: usar defaults
  }
  const defaults = mergeWithDefaults({})
  saveConfig(defaults)
  return defaults
}

function saveConfig(config: AppConfig): void {
  mkdirSync(USER_DATA, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// ─── PTY sessions ────────────────────────────────────────────────────────────

interface PtySession {
  pty: IPty
  windowId: number
}

const sessions = new Map<string, PtySession>()

function resolveShellPath(): string {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(
    (p): p is string => Boolean(p && p.trim())
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

let ptyHandlersRegistered = false

function registerPtyHandlersOnce(): void {
  if (ptyHandlersRegistered) return
  ptyHandlersRegistered = true

  ipcMain.on(IPC.PTY_CREATE, (event, sessionId: string, cwdOpt?: unknown) => {
    if (sessions.has(sessionId)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const shellPath = resolveShellPath()
    const home = app.getPath('home')
    const startCwd = resolveSpawnCwd(cwdOpt, home)
    let instance: IPty
    try {
      instance = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: startCwd,
        env: {
          ...process.env,
          HOME: home,
          SHELL: shellPath,
          TERM: 'xterm-256color',
          TERM_PROGRAM: 'AI Terminal',
        } as Record<string, string>,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[pty] spawn failed:', shellPath, msg)
      if (!win.isDestroyed()) {
        win.webContents.send(
          IPC.PTY_ERROR,
          sessionId,
          `No se pudo iniciar la shell (${shellPath}): ${msg}\r\n` +
            'Si ves "posix_spawnp failed", ejecuta en la carpeta del proyecto:\r\n' +
            '  npm run rebuild:native\r\n' +
            'o vuelve a ejecutar npm install (postinstall recompila node-pty para Electron).\r\n'
        )
      }
      return
    }

    const windowId = win.id
    sessions.set(sessionId, { pty: instance, windowId })
    ensureSessionCdState(sessionId, home)
    initSessionCwd(sessionId, startCwd)

    instance.onData((data: string) => {
      const w = BrowserWindow.getAllWindows().find(b => !b.isDestroyed() && b.id === windowId)
      if (w && !w.isDestroyed()) {
        w.webContents.send(IPC.PTY_DATA, sessionId, data)
      }
    })
    instance.onExit(({ exitCode }: { exitCode: number }) => {
      sessions.delete(sessionId)
      clearSessionCdState(sessionId)
      const w = BrowserWindow.getAllWindows().find(b => !b.isDestroyed() && b.id === windowId)
      if (w && !w.isDestroyed()) {
        w.webContents.send(IPC.PTY_EXIT, sessionId, exitCode)
      }
    })
  })

  ipcMain.on(IPC.PTY_WRITE, (_event, sessionId: string, data: string) => {
    sessions.get(sessionId)?.pty.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    const s = sessions.get(sessionId)
    if (s) {
      try { s.pty.resize(cols, rows) } catch { /* ignore */ }
    }
  })

  ipcMain.on(IPC.PTY_KILL, (_event, sessionId: string) => {
    clearSessionCdState(sessionId)
    const s = sessions.get(sessionId)
    if (s) {
      try { s.pty.kill() } catch { /* ignore */ }
      sessions.delete(sessionId)
    }
  })
}

/** README del proyecto para contexto del asistente IA (dev + empaquetado). */
function readAppReadme(): string {
  const candidates = [
    join(app.getAppPath(), 'README.md'),
    join(dirname(app.getAppPath()), 'README.md'),
    join(__dirname, '..', '..', 'README.md'),
    join(__dirname, '..', '..', '..', 'README.md'),
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      /* siguiente candidato */
    }
  }
  return ''
}

// ─── Config handlers ──────────────────────────────────────────────────────────

function registerConfigHandlers(): void {
  ipcMain.handle(IPC.CONFIG_GET, () => loadConfig())

  ipcMain.handle(IPC.CONFIG_SET, (_event, partial: Partial<AppConfig>) => {
    const current = loadConfig()
    const updated = mergeWithDefaults({ ...current, ...partial })
    const errors = validateConfig(updated)
    if (errors.length) return { ok: false, errors }
    saveConfig(updated)
    return { ok: true }
  })

  ipcMain.on(IPC.CONFIG_OPEN_FOLDER, () => {
    shell.showItemInFolder(CONFIG_PATH)
  })

  ipcMain.handle(IPC.CD_RECENT_LIST, () => readCdRecentFolders())

  ipcMain.on(IPC.CD_RECENT_RECORD_LINE, (_event, sessionId: unknown, line: unknown) => {
    if (typeof sessionId !== 'string' || typeof line !== 'string') return
    const home = app.getPath('home')
    recordCdFromUserLine(sessionId, line, home)
  })

  ipcMain.handle(IPC.GET_SESSION_CWD, (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return null
    return getSessionCwd(sessionId) ?? app.getPath('home')
  })

  ipcMain.handle(IPC.LIST_CWD_DIRS, (_event, sessionId: unknown): string[] => {
    if (typeof sessionId !== 'string') return []
    const cwd = getSessionCwd(sessionId) ?? app.getPath('home')
    try {
      return readdirSync(cwd, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name)
        .sort((a, b) => a.localeCompare(b))
    } catch {
      return []
    }
  })

  ipcMain.on(IPC.OPEN_FOLDER, (_event, folderPath: unknown) => {
    if (typeof folderPath === 'string' && folderPath) {
      shell.openPath(folderPath).catch(() => {})
    }
  })

  ipcMain.handle(IPC.APP_README_GET, () => readAppReadme())

  ipcMain.handle(IPC.PROJECT_AI_CONTEXT_GET, (_event, sessionId: unknown): ProjectAiContextForAi | null => {
    if (typeof sessionId !== 'string') return null
    const home = app.getPath('home')
    const cwd = getSessionCwd(sessionId) ?? home
    return gatherProjectAiContextForCwd(cwd)
  })

  // ─── Persistencia ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SESSION_LOAD, (): PersistedSession | null => loadSession())

  ipcMain.on(IPC.SESSION_SAVE, (_event, data: unknown) => {
    if (data && typeof data === 'object') saveSession(data as PersistedSession)
  })

  ipcMain.handle(IPC.AI_CHAT_LOAD, (_event, paneId: unknown): ChatEntry[] => {
    if (typeof paneId !== 'string') return []
    return loadAiChat(paneId)
  })

  ipcMain.on(IPC.AI_CHAT_SAVE, (_event, paneId: unknown, entries: unknown) => {
    if (typeof paneId !== 'string' || !Array.isArray(entries)) return
    saveAiChat(paneId, entries as ChatEntry[])
  })

  ipcMain.on(IPC.AI_CHAT_DELETE, (_event, paneId: unknown) => {
    if (typeof paneId === 'string') deleteAiChat(paneId)
  })

  ipcMain.handle(IPC.CMD_HISTORY_LOAD, (_event, paneId: unknown): string[] => {
    if (typeof paneId !== 'string') return []
    return loadCmdHistory(paneId)
  })

  ipcMain.on(IPC.CMD_HISTORY_SAVE, (_event, paneId: unknown, lines: unknown) => {
    if (typeof paneId !== 'string' || !Array.isArray(lines)) return
    saveCmdHistory(paneId, lines as string[])
  })

  ipcMain.on(IPC.CMD_HISTORY_DELETE, (_event, paneId: unknown) => {
    if (typeof paneId === 'string') deleteCmdHistory(paneId)
  })

  ipcMain.handle(IPC.SCROLLBACK_LOAD, (_event, paneId: unknown): string | null => {
    if (typeof paneId !== 'string') return null
    return loadScrollback(paneId)
  })

  ipcMain.on(IPC.SCROLLBACK_SAVE, (_event, paneId: unknown, data: unknown) => {
    if (typeof paneId !== 'string' || typeof data !== 'string') return
    saveScrollback(paneId, data)
  })

  ipcMain.on(IPC.SCROLLBACK_DELETE, (_event, paneId: unknown) => {
    if (typeof paneId === 'string') deleteScrollback(paneId)
  })
}

// ─── Window ──────────────────────────────────────────────────────────────────

/** PNG en `build/icon.png` (misma que usa electron-builder para el .app). Opcional en dev. */
function resolveOptionalWindowIcon(): string | undefined {
  const png = join(__dirname, '../../build/icon.png')
  try {
    if (existsSync(png)) return png
  } catch { /* ignore */ }
  return undefined
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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // ⌘W: si lo deja el menú nativo, cierra la ventana entera. Interceptamos y el renderer cierra solo la pestaña si hay más de una.
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

  if (process.env.NODE_ENV === 'development') {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173')
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1' || process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Antes de cerrar: pedir al renderer que serialice los scrollbacks y esperar respuesta
  let closingFromReady = false
  win.on('close', e => {
    if (closingFromReady) return
    e.preventDefault()
    win.webContents.send(IPC.APP_SAVE_BEFORE_CLOSE)

    // Timeout de seguridad: si el renderer no responde en 3s, cerramos igual
    const timeout = setTimeout(() => {
      closingFromReady = true
      win.destroy()
    }, 3000)

    ipcMain.once(IPC.APP_CLOSE_READY, (_ev, scrollbacks: unknown) => {
      clearTimeout(timeout)
      if (scrollbacks && typeof scrollbacks === 'object') {
        for (const [paneId, data] of Object.entries(scrollbacks as Record<string, string>)) {
          if (typeof data === 'string') saveScrollback(paneId, data)
        }
      }
      closingFromReady = true
      win.destroy()
    })
  })

  win.on('closed', () => {
    for (const [id, s] of [...sessions.entries()]) {
      if (s.windowId === win.id) {
        try { s.pty.kill() } catch { /* ignore */ }
        sessions.delete(id)
        clearSessionCdState(id)
      }
    }
  })

  return win
}

app.whenReady().then(() => {
  loadConfig()
  registerConfigHandlers()
  registerPtyHandlersOnce()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
