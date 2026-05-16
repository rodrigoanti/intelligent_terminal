import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import type { AppConfig } from '../src/shared/configSchema'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import type { PersistedSession, ChatEntry } from './persistence'
import type { SpotifyPlaybackState } from './spotifyNative'
import type { GitCommandResult, GitDiffForAiPayload, GitRepoStatus } from '../src/shared/gitSessionTypes'
import type { GitHubActionsSnapshot } from '../src/shared/githubActionsTypes'
import type {
  FileExplorerFilePayload,
  FileExplorerGitMapResult,
  FileExplorerListResult,
} from '../src/shared/fileExplorerTypes'

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

  openExternalUrl(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.OPEN_EXTERNAL_URL, url)
  },

  spotifyDesktopInstalled(): Promise<boolean> {
    return ipcRenderer.invoke(IPC.SPOTIFY_DESKTOP_INSTALLED)
  },

  spotifyPlayPlaylist(
    playlistId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PLAY_PLAYLIST, playlistId)
  },

  spotifyPause(): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PAUSE)
  },

  spotifyPlay(): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PLAY)
  },

  spotifyGetState(): Promise<SpotifyPlaybackState> {
    return ipcRenderer.invoke(IPC.SPOTIFY_GET_STATE)
  },

  getProjectAiContext(sessionId: string): Promise<ProjectAiContextForAi | null> {
    return ipcRenderer.invoke(IPC.PROJECT_AI_CONTEXT_GET, sessionId)
  },

  readAgentMd(sessionId: string): Promise<string | null> {
    return ipcRenderer.invoke(IPC.AGENT_MD_READ, sessionId)
  },

  writeAgentMd(
    sessionId: string,
    content: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_MD_WRITE, sessionId, content)
  },

  getAgentFolderTree(sessionId: string): Promise<string> {
    return ipcRenderer.invoke(IPC.AGENT_MD_TREE, sessionId)
  },

  agentReadFile(
    sessionId: string,
    relPath: string,
  ): Promise<{ ok: boolean; content?: string; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_FILE_READ, sessionId, relPath)
  },

  agentWriteFile(
    sessionId: string,
    relPath: string,
    content: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_FILE_WRITE, sessionId, relPath, content)
  },

  agentRunShell(
    sessionId: string,
    command: string,
  ): Promise<
    | { ok: true; exitCode: number | null; stdout: string; stderr: string }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.AGENT_SHELL_RUN, sessionId, command)
  },

  gitStatus(sessionId: string): Promise<GitRepoStatus> {
    return ipcRenderer.invoke(IPC.GIT_STATUS, sessionId)
  },

  gitDiffForAi(sessionId: string): Promise<GitDiffForAiPayload> {
    return ipcRenderer.invoke(IPC.GIT_DIFF_FOR_AI, sessionId)
  },

  gitPull(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PULL, sessionId)
  },

  gitPush(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PUSH, sessionId)
  },

  gitCommit(sessionId: string, message: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_COMMIT, sessionId, message)
  },

  gitStageAll(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_STAGE_ALL, sessionId)
  },

  githubActionsList(sessionId: string): Promise<GitHubActionsSnapshot> {
    return ipcRenderer.invoke(IPC.GITHUB_ACTIONS_LIST, sessionId)
  },

  fileExplorerListDir(sessionId: string, relPath: string): Promise<FileExplorerListResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_LIST_DIR, sessionId, relPath)
  },

  fileExplorerLoadFile(sessionId: string, relPath: string): Promise<FileExplorerFilePayload> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_LOAD_FILE, sessionId, relPath)
  },

  fileExplorerGitMap(sessionId: string): Promise<FileExplorerGitMapResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_GIT_MAP, sessionId)
  },

  // ─── Persistencia ────────────────────────────────────────────────────────
  loadSession(): Promise<PersistedSession | null> {
    return ipcRenderer.invoke(IPC.SESSION_LOAD)
  },
  saveSession(data: PersistedSession): Promise<void> {
    return ipcRenderer.invoke(IPC.SESSION_SAVE, data)
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
  loadInteractionsLog(paneId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.INTERACTIONS_LOG_LOAD, paneId)
  },
  saveInteractionsLog(paneId: string, entries: string[]): void {
    ipcRenderer.send(IPC.INTERACTIONS_LOG_SAVE, paneId, entries)
  },
  deleteInteractionsLog(paneId: string): void {
    ipcRenderer.send(IPC.INTERACTIONS_LOG_DELETE, paneId)
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
