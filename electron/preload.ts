import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import type { AppConfig } from '../src/shared/configSchema'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import type { PersistedSession, ChatEntry } from './persistence'

const api = {
  // ─── PTY ───────────────────────────────────────────────────────────────────
  ptyCreate(sessionId: string, cwd?: string): void {
    ipcRenderer.send(IPC.PTY_CREATE, sessionId, cwd)
  },
  ptyWrite(sessionId: string, data: string): void {
    ipcRenderer.send(IPC.PTY_WRITE, sessionId, data)
  },
  ptyResize(sessionId: string, cols: number, rows: number): void {
    ipcRenderer.send(IPC.PTY_RESIZE, sessionId, cols, rows)
  },
  ptyKill(sessionId: string): void {
    ipcRenderer.send(IPC.PTY_KILL, sessionId)
  },
  onPtyData(sessionId: string, cb: (data: string) => void): () => void {
    const listener = (_: Electron.IpcRendererEvent, sid: string, data: string): void => {
      if (sid === sessionId) cb(data)
    }
    ipcRenderer.on(IPC.PTY_DATA, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
  },
  onPtyExit(sessionId: string, cb: (code: number) => void): () => void {
    const listener = (_: Electron.IpcRendererEvent, sid: string, code: number): void => {
      if (sid === sessionId) cb(code)
    }
    ipcRenderer.on(IPC.PTY_EXIT, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, listener)
  },
  onPtyError(sessionId: string, cb: (message: string) => void): () => void {
    const listener = (_: Electron.IpcRendererEvent, sid: string, message: string): void => {
      if (sid === sessionId) cb(message)
    }
    ipcRenderer.on(IPC.PTY_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_ERROR, listener)
  },

  onShortcutCloseTab(cb: () => void): () => void {
    const listener = (): void => {
      cb()
    }
    ipcRenderer.on(IPC.SHORTCUT_CLOSE_TAB, listener)
    return () => ipcRenderer.removeListener(IPC.SHORTCUT_CLOSE_TAB, listener)
  },

  // ─── Config ────────────────────────────────────────────────────────────────
  getConfig(): Promise<AppConfig> {
    return ipcRenderer.invoke(IPC.CONFIG_GET)
  },
  setConfig(partial: Partial<AppConfig>): Promise<{ ok: boolean; errors?: string[] }> {
    return ipcRenderer.invoke(IPC.CONFIG_SET, partial)
  },
  openConfigFolder(): void {
    ipcRenderer.send(IPC.CONFIG_OPEN_FOLDER)
  },

  getCdRecentList(): Promise<string[]> {
    return ipcRenderer.invoke(IPC.CD_RECENT_LIST)
  },

  recordCdLine(sessionId: string, line: string): void {
    ipcRenderer.send(IPC.CD_RECENT_RECORD_LINE, sessionId, line)
  },

  getSessionCwd(sessionId: string): Promise<string> {
    return ipcRenderer.invoke(IPC.GET_SESSION_CWD, sessionId)
  },

  listCwdDirs(sessionId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.LIST_CWD_DIRS, sessionId)
  },

  openFolder(folderPath: string): void {
    ipcRenderer.send(IPC.OPEN_FOLDER, folderPath)
  },

  getAppReadme(): Promise<string> {
    return ipcRenderer.invoke(IPC.APP_README_GET)
  },

  getProjectAiContext(sessionId: string): Promise<ProjectAiContextForAi | null> {
    return ipcRenderer.invoke(IPC.PROJECT_AI_CONTEXT_GET, sessionId)
  },

  // ─── Persistencia ────────────────────────────────────────────────────────
  loadSession(): Promise<PersistedSession | null> {
    return ipcRenderer.invoke(IPC.SESSION_LOAD)
  },
  saveSession(data: PersistedSession): void {
    ipcRenderer.send(IPC.SESSION_SAVE, data)
  },
  loadAiChat(paneId: string): Promise<ChatEntry[]> {
    return ipcRenderer.invoke(IPC.AI_CHAT_LOAD, paneId)
  },
  saveAiChat(paneId: string, entries: ChatEntry[]): void {
    ipcRenderer.send(IPC.AI_CHAT_SAVE, paneId, entries)
  },
  deleteAiChat(paneId: string): void {
    ipcRenderer.send(IPC.AI_CHAT_DELETE, paneId)
  },
  loadCmdHistory(paneId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.CMD_HISTORY_LOAD, paneId)
  },
  saveCmdHistory(paneId: string, lines: string[]): void {
    ipcRenderer.send(IPC.CMD_HISTORY_SAVE, paneId, lines)
  },
  deleteCmdHistory(paneId: string): void {
    ipcRenderer.send(IPC.CMD_HISTORY_DELETE, paneId)
  },
  loadScrollback(paneId: string): Promise<string | null> {
    return ipcRenderer.invoke(IPC.SCROLLBACK_LOAD, paneId)
  },
  saveScrollback(paneId: string, data: string): void {
    ipcRenderer.send(IPC.SCROLLBACK_SAVE, paneId, data)
  },
  deleteScrollback(paneId: string): void {
    ipcRenderer.send(IPC.SCROLLBACK_DELETE, paneId)
  },
  onSaveBeforeClose(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.APP_SAVE_BEFORE_CLOSE, listener)
    return () => ipcRenderer.removeListener(IPC.APP_SAVE_BEFORE_CLOSE, listener)
  },
  sendCloseReady(scrollbacks: Record<string, string>): void {
    ipcRenderer.send(IPC.APP_CLOSE_READY, scrollbacks)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
