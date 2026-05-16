import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { getTheme } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { feedCompletedUserLines } from '@renderer/history/feedCompletedUserLines'
import { stripLeadingShellPrompts } from '@renderer/terminal/stripShellPromptPrefix'
import { AiPanel } from '@renderer/components/AiPanel'
import { ConfirmTerminalModal } from '@renderer/components/ConfirmTerminalModal'
import { GitPanelModal } from '@renderer/components/GitPanelModal'
import { TerminalFindModal } from '@renderer/components/TerminalFindModal'
import {
  findMatchesInCommandHistory,
  findMatchesInTerminalBuffer,
  type TerminalBufferFindMatch,
} from '@renderer/terminal/terminalFindInBuffer'
import { PaneToolbar } from './PaneToolbar'
import { CdSuggest } from './CdSuggest'
import { CmdSuggest } from './CmdSuggest'
import { TerminalScrollDown } from './TerminalScrollDown'
import { SplitPaneButton } from './SplitPaneButton'
import '@xterm/xterm/css/xterm.css'
import './TerminalPane.css'

function shellSingleQuotePosix(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`
}

function isCdStart(draft: string): boolean {
  return /^cd(\s|$)/i.test(draft.trimStart())
}

function filterPaths(paths: string[], draft: string): string[] {
  const arg = draft.trimStart().replace(/^cd\s*/i, '')
  if (!arg) return paths
  const lower = arg.toLowerCase()
  return paths.filter(p => p.toLowerCase().includes(lower))
}

// ── Sugerencias de comandos ────────────────────────────────────────────────

interface CmdSnippet { label: string; cmd: string }

const CMD_SNIPPETS: Record<string, CmdSnippet[]> = {
  git: [
    { label: 'git status',              cmd: 'git status' },
    { label: 'git add .',               cmd: 'git add .' },
    { label: 'git commit -m ""',        cmd: 'git commit -m ""' },
    { label: 'git push',                cmd: 'git push' },
    { label: 'git pull',                cmd: 'git pull' },
    { label: 'git log --oneline',       cmd: 'git log --oneline' },
    { label: 'git diff',                cmd: 'git diff' },
    { label: 'git checkout -b',         cmd: 'git checkout -b ' },
    { label: 'git stash',               cmd: 'git stash' },
    { label: 'git merge',               cmd: 'git merge ' },
  ],
  npm: [
    { label: 'npm install',             cmd: 'npm install' },
    { label: 'npm run dev',             cmd: 'npm run dev' },
    { label: 'npm run build',           cmd: 'npm run build' },
    { label: 'npm run test',            cmd: 'npm run test' },
    { label: 'npm install -D',          cmd: 'npm install --save-dev ' },
    { label: 'npm uninstall',           cmd: 'npm uninstall ' },
    { label: 'npm list',                cmd: 'npm list' },
    { label: 'npm outdated',            cmd: 'npm outdated' },
    { label: 'npm update',              cmd: 'npm update' },
    { label: 'npm init -y',             cmd: 'npm init -y' },
  ],
  pnpm: [
    { label: 'pnpm install',            cmd: 'pnpm install' },
    { label: 'pnpm run dev',            cmd: 'pnpm run dev' },
    { label: 'pnpm run build',          cmd: 'pnpm run build' },
    { label: 'pnpm run test',           cmd: 'pnpm run test' },
    { label: 'pnpm add -D',             cmd: 'pnpm add -D ' },
    { label: 'pnpm remove',             cmd: 'pnpm remove ' },
    { label: 'pnpm list',               cmd: 'pnpm list' },
    { label: 'pnpm outdated',           cmd: 'pnpm outdated' },
    { label: 'pnpm update',             cmd: 'pnpm update' },
    { label: 'pnpm init',               cmd: 'pnpm init' },
  ],
  docker: [
    { label: 'docker ps',               cmd: 'docker ps' },
    { label: 'docker ps -a',            cmd: 'docker ps -a' },
    { label: 'docker build -t',         cmd: 'docker build -t ' },
    { label: 'docker run -it',          cmd: 'docker run -it ' },
    { label: 'docker stop',             cmd: 'docker stop ' },
    { label: 'docker rm',               cmd: 'docker rm ' },
    { label: 'docker images',           cmd: 'docker images' },
    { label: 'docker pull',             cmd: 'docker pull ' },
    { label: 'docker logs -f',          cmd: 'docker logs -f ' },
    { label: 'docker exec -it',         cmd: 'docker exec -it ' },
  ],
  ssh: [
    { label: 'ssh user@host',           cmd: 'ssh user@' },
    { label: 'ssh -p 22',               cmd: 'ssh -p 22 user@' },
    { label: 'ssh -i key.pem',          cmd: 'ssh -i ~/.ssh/id_rsa user@' },
    { label: 'ssh-keygen -t ed25519',   cmd: 'ssh-keygen -t ed25519' },
    { label: 'ssh-copy-id',             cmd: 'ssh-copy-id user@' },
  ],
  grep: [
    { label: 'grep -r "" .',            cmd: 'grep -r "" .' },
    { label: 'grep -ri "" .',           cmd: 'grep -ri "" .' },
    { label: 'grep -n "" file',         cmd: 'grep -n ""  ' },
    { label: 'grep -l "" .',            cmd: 'grep -l "" .' },
    { label: 'grep -v ""',              cmd: 'grep -v "" ' },
  ],
  find: [
    { label: 'find . -name',            cmd: 'find . -name "" ' },
    { label: 'find . -type f',          cmd: 'find . -type f' },
    { label: 'find . -type d',          cmd: 'find . -type d' },
    { label: 'find . -mtime -1',        cmd: 'find . -mtime -1' },
    { label: 'find . -name "*.ts"',     cmd: 'find . -name "*.ts"' },
  ],
  curl: [
    { label: 'curl -X GET',             cmd: 'curl -X GET ' },
    { label: 'curl -X POST -d',         cmd: 'curl -X POST -H "Content-Type: application/json" -d \'{}\' ' },
    { label: 'curl -o file',            cmd: 'curl -o output ' },
    { label: 'curl -L -O',              cmd: 'curl -L -O ' },
    { label: 'curl -s | jq',            cmd: 'curl -s  | jq .' },
  ],
  tar: [
    { label: 'tar -czf file.tar.gz',    cmd: 'tar -czf output.tar.gz ' },
    { label: 'tar -xzf file.tar.gz',    cmd: 'tar -xzf ' },
    { label: 'tar -tzf file.tar.gz',    cmd: 'tar -tzf ' },
    { label: 'tar -xjf file.tar.bz2',   cmd: 'tar -xjf ' },
    { label: 'tar -czf - | ssh',        cmd: 'tar -czf - . | ssh user@host "cat > backup.tar.gz"' },
  ],
  python: [
    { label: 'python -m venv venv',     cmd: 'python -m venv venv' },
    { label: 'python -m pip install',   cmd: 'python -m pip install ' },
    { label: 'python -c ""',            cmd: 'python -c ""' },
    { label: 'python -m http.server',   cmd: 'python -m http.server 8080' },
    { label: 'python -m pytest',        cmd: 'python -m pytest' },
  ],
  node: [
    { label: 'node -e ""',              cmd: 'node -e ""' },
    { label: 'node --inspect',          cmd: 'node --inspect ' },
    { label: 'node -r dotenv/config',   cmd: 'node -r dotenv/config ' },
    { label: 'node --version',          cmd: 'node --version' },
    { label: 'node -p ""',              cmd: 'node -p ""' },
  ],
}

const CMD_SNIPPET_KEYS = Object.keys(CMD_SNIPPETS)

function getMatchedCmd(trimmedDraft: string): string | null {
  for (const cmd of CMD_SNIPPET_KEYS) {
    if (new RegExp(`^${cmd}(\\s|$)`, 'i').test(trimmedDraft)) return cmd
  }
  return null
}

function filterCmdSnippetsByDraft(all: CmdSnippet[], trimmedDraft: string): CmdSnippet[] {
  const d = trimmedDraft.trimStart().toLowerCase()
  if (!d) return all
  return all.filter(
    s =>
      s.cmd.toLowerCase().startsWith(d) ||
      s.label.toLowerCase().startsWith(d),
  )
}

const MAX_RECENT_COMMANDS = 120
const MAX_VISIBLE_RECENT_MATCHES = 5

/** MRU sin duplicados exactos (tras trim); el más reciente queda primero. */
function pushRecentUnique(prev: string[], line: string, max: number): string[] {
  const t = line.trim()
  if (!t) return prev
  return [t, ...prev.filter(x => x !== t)].slice(0, max)
}

/**
 * Historial de líneas ejecutadas (MRU), filtrado solo por si el borrador aparece en la línea.
 * Independiente de CMD_SNIPPETS. No lista `cd` (va al panel de carpetas).
 */
function filterExecutedRecentsByDraft(recent: string[], draft: string, limit: number): string[] {
  const d = draft.trimStart()
  if (!d || isCdStart(d)) return []
  const dl = d.toLowerCase()
  const out: string[] = []
  for (const c of recent) {
    const t = c.trim()
    if (!t || isCdStart(t)) continue
    if (!t.toLowerCase().includes(dl)) continue
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}





/**
 * Ajusta columnas/filas al contenedor sin “saltar” el scroll: si el usuario estaba
 * abajo del todo (prompt), se mantiene abajo; si había subido en el historial,
 * se conserva la misma línea superior del viewport.
 */
function fitTerminalPreserveScroll(term: Terminal, fit: FitAddon): void {
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') {
      fit.fit()
      return
    }
    const savedTop = buf.viewportY
    const wasAtBottom = savedTop >= buf.baseY
    fit.fit()
    const b = term.buffer.active
    if (b.type !== 'normal') return
    if (wasAtBottom) {
      term.scrollToBottom()
      return
    }
    const target = Math.min(Math.max(0, savedTop), Math.max(0, b.baseY))
    term.scrollToLine(target)
  } catch {
    /* syncScrollArea / dimensions */
  }
}

/**
 * Escribe salida del PTY y, si el usuario iba pegado al fondo sin selección,
 * fuerza el scroll al final usando el callback de term.write() en lugar de rAF.
 */
function writePtyDataWithFollowScroll(term: Terminal, data: string, afterParsed?: () => void): void {
  try {
    const buf = term.buffer.active
    const wasFollowing =
      buf.type === 'normal' &&
      buf.viewportY >= buf.baseY &&
      term.getSelection().length === 0
    term.write(data, () => {
      try {
        if (wasFollowing && term.buffer.active.type === 'normal') {
          term.scrollToBottom()
        }
      } catch {
        /* xterm puede estar disposed o sin dimensions (Viewport.syncScrollArea) */
      }
      try {
        afterParsed?.()
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* buffer / write inválido (dispose en curso) */
  }
}

/**
 * Extrae las últimas `maxLines` líneas del buffer visible de xterm.
 * Usa `buf.baseY + term.rows` para obtener el total real de líneas escritas
 * (evita contar líneas pre-asignadas vacías del scrollback).
 */
function getScrollback(term: Terminal, maxLines: number): string {
  const buf = term.buffer.active
  const total = buf.baseY + term.rows
  const from = Math.max(0, total - maxLines)
  const lines: string[] = []
  for (let i = from; i < total; i++) {
    const line = buf.getLine(i)
    if (line) lines.push(line.translateToString(true))
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

export interface TerminalRef {
  getSelection: () => string
  writeToTty: (data: string) => void
  /** Alterna chat IA a pantalla completa en el panel ↔ colapsado (⌘I). */
  toggleAiFullscreen: () => void
  /** Serializa el buffer completo (VT sequences) para persistencia */
  serialize: () => string
}

export interface PaneToolbar {
  onClosePane?: () => void
  /** Reordenar columnas dentro de la pestaña (solo si hay varios paneIds). */
  paneReorder?: {
    enabled: boolean
    isGrabbed: boolean
    onDragHandleStart: (e: React.DragEvent) => void
    onDragHandleEnd: () => void
  }
}

interface Props {
  sessionId: string
  /** Cada panel: chat IA expandido (lo persiste App en session.json) */
  aiExpanded: boolean
  onAiExpandedChange: (expanded: boolean) => void
  /** La pestaña está seleccionada en la barra */
  tabActive: boolean
  /** Este panel tiene el foco dentro de la pestaña (clic o último split) */
  isActivePane: boolean
  /** cwd inicial al crear el PTY (solo panel nuevo al dividir) */
  initialPtyCwd?: string
  paneToolbar?: PaneToolbar
  /** Otra terminal a la derecha (solo en el panel activo de la pestaña activa) */
  onRequestSplitPane?: () => void
  /** Al interactuar con este panel, selecciona pestaña y enfoca este split */
  onRequestPaneFocus?: () => void
  config: AppConfig
  onTitleChange: (title: string) => void
  onRegisterRef: (ref: TerminalRef | null) => void
  /** Notifica si este panel tiene un proceso activo (true) o ha vuelto al prompt (false). */
  onBusyChange?: (busy: boolean) => void
  /** Actualizar partes de la configuración global (p. ej. modo agente) */
  onConfigPatch?: (partial: Partial<AppConfig>) => void | Promise<void>
  /**
   * Registra la misma confirmación que la cruz del panel para cierres por atajo (⌘W desde `App`).
   */
  registerShortcutCloseInterceptor?: (openConfirm: () => void) => () => void
}

export const TerminalPane: React.FC<Props> = ({
  sessionId,
  aiExpanded,
  onAiExpandedChange,
  tabActive,
  isActivePane,
  initialPtyCwd,
  paneToolbar,
  onRequestSplitPane,
  onRequestPaneFocus,
  config,
  onConfigPatch,
  onTitleChange,
  onRegisterRef,
  onBusyChange,
  registerShortcutCloseInterceptor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const userLineDraftRef = useRef('')
  const absorbUserInputRef = useRef<(raw: string) => void>(() => {})
  const ptyInjectRef = useRef<(raw: string) => void>(() => {})
  const scrollbackSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busySilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isBusyRef = useRef(false)
  const onBusyChangeRef = useRef(onBusyChange)
  onBusyChangeRef.current = onBusyChange
  const toggleAiFullscreenRef = useRef<() => void>(() => {})
  const configRef = useRef(config)
  configRef.current = config

  const [cdVisible, setCdVisible] = useState(false)
  const [cdDraft, setCdDraft] = useState('')
  const [cdPaths, setCdPaths] = useState<string[]>([])
  const [cdLocalDirs, setCdLocalDirs] = useState<string[]>([])
  const cdVisibleRef = useRef(false)

  const [cmdSuggestCmd, setCmdSuggestCmd] = useState<string | null>(null)
  const [cmdSuggestDraft, setCmdSuggestDraft] = useState('')
  const [recentCommands, setRecentCommands] = useState<string[]>([])
  const [cmdHistoryLoaded, setCmdHistoryLoaded] = useState(false)
  const cmdHistoryLoadedRef = useRef(false)
  const recentCommandsRef = useRef<string[]>([])
  recentCommandsRef.current = recentCommands
  const cmdHistorySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [aiSelectedText, setAiSelectedText] = useState('')
  const [confirmClosePaneOpen, setConfirmClosePaneOpen] = useState(false)
  const registerShortcutInterceptorRef = useRef(registerShortcutCloseInterceptor)
  registerShortcutInterceptorRef.current = registerShortcutCloseInterceptor

  const hasClosePaneAction = Boolean(paneToolbar?.onClosePane)
  useEffect(() => {
    if (!hasClosePaneAction) return
    const reg = registerShortcutInterceptorRef.current
    if (!reg) return
    return reg(() => {
      setConfirmClosePaneOpen(true)
    })
  }, [hasClosePaneAction])

  const [gitPanelOpen, setGitPanelOpen] = useState(false)
  const [findModalOpen, setFindModalOpen] = useState(false)
  const [findModalBuffer, setFindModalBuffer] = useState<TerminalBufferFindMatch[]>([])
  const [findModalHistory, setFindModalHistory] = useState<string[]>([])
  const [terminalScrollDownVisible, setTerminalScrollDownVisible] = useState(false)
  /**
   * Foco en shell / barra del panel (no en chat IA). Se usa para el botón «bajar al final»;
   * el botón cerrar ya no depende de esto: si el foco parpadea a `document.body` al pulsar X,
   * condicionar el render ahí desmontaba el botón antes del `click`.
   */
  const [shellOrToolbarFocused, setShellOrToolbarFocused] = useState(false)

  const isActivePaneRef = useRef(isActivePane)
  isActivePaneRef.current = isActivePane

  const tabActiveRef = useRef(tabActive)
  tabActiveRef.current = tabActive

  const paneRootRef = useRef<HTMLDivElement>(null)
  const aiDockRef = useRef<HTMLDivElement>(null)

  const onRequestPaneFocusRef = useRef(onRequestPaneFocus)
  onRequestPaneFocusRef.current = onRequestPaneFocus

  const syncShellOrToolbarFocus = useCallback((): void => {
    const root = paneRootRef.current
    const ae = document.activeElement as HTMLElement | null
    if (!tabActiveRef.current || !isActivePaneRef.current || !root || !ae || !root.contains(ae)) {
      setShellOrToolbarFocused(false)
      return
    }
    if (ae.closest('.terminal-pane-ai-dock')) {
      setShellOrToolbarFocused(false)
      return
    }
    setShellOrToolbarFocused(
      Boolean(
        ae.closest('.terminal-pane-body') ||
          ae.closest('.pane-toolbar') ||
          ae.closest('.terminal-chrome-btn'),
      ),
    )
  }, [])

  useEffect(() => {
    if (!tabActive || !isActivePane) {
      setShellOrToolbarFocused(false)
      return
    }
    queueMicrotask(() => { syncShellOrToolbarFocus() })
  }, [tabActive, isActivePane, syncShellOrToolbarFocus])

  useEffect(() => {
    const root = paneRootRef.current
    if (!root) return
    const onFocus = (): void => {
      queueMicrotask(() => { syncShellOrToolbarFocus() })
    }
    root.addEventListener('focusin', onFocus)
    root.addEventListener('focusout', onFocus)
    return () => {
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('focusout', onFocus)
    }
  }, [sessionId, syncShellOrToolbarFocus])

  /**
   * Los botones chrome (cerrar, scroll, +) no deben robar el foco del PTY: si el <button>
   * recibe foco, `shellOrToolbarFocused` puede quedar false en el microtask del focusout
   * y React desmonta el botón antes del click. preventDefault en mousedown evita ese foco.
   */
  const onTerminalChromePointerDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const openThisPaneFolderInFinder = useCallback(async (): Promise<void> => {
    try {
      const cwd = await window.api.getSessionCwd(sessionId)
      if (cwd) window.api.openFolder(cwd)
    } catch { /* ignore */ }
  }, [sessionId])

  /** Reserva espacio bajo el xterm cuando el dock IA está colapsado (overlay absolute). */
  useLayoutEffect(() => {
    const root = paneRootRef.current
    const dock = aiDockRef.current
    if (!root || !dock) return

    const apply = (): void => {
      if (aiExpanded) {
        root.style.setProperty('--terminal-ai-dock-reserve', '0px')
        return
      }
      const h = dock.getBoundingClientRect().height
      root.style.setProperty('--terminal-ai-dock-reserve', `${Math.ceil(h)}px`)
    }

    apply()
    if (aiExpanded) return

    const ro = new ResizeObserver(() => { apply() })
    ro.observe(dock)
    return () => { ro.disconnect() }
  }, [aiExpanded])

  const loadCdPaths = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getCdRecentList()
      setCdPaths(list)
    } catch { /* ignore */ }
  }, [])

  const loadCdLocalDirs = useCallback(async (): Promise<void> => {
    try {
      const dirs = await window.api.listCwdDirs(sessionId)
      setCdLocalDirs(dirs)
    } catch { /* ignore */ }
  }, [sessionId])

  useEffect(() => { void loadCdPaths() }, [loadCdPaths])

  // Historial de comandos (mismo paneId que chat IA / scrollback): carga y guardado con debounce
  useEffect(() => {
    cmdHistoryLoadedRef.current = false
    setRecentCommands([])
    setCmdHistoryLoaded(false)
    let cancelled = false
    void window.api.loadCmdHistory(sessionId).then(lines => {
      if (cancelled) return
      setRecentCommands(lines.slice(0, MAX_RECENT_COMMANDS))
      setCmdHistoryLoaded(true)
      cmdHistoryLoadedRef.current = true
    }).catch(() => {
      if (cancelled) return
      setRecentCommands([])
      setCmdHistoryLoaded(true)
      cmdHistoryLoadedRef.current = true
    })
    return () => {
      cancelled = true
      if (cmdHistorySaveTimerRef.current) {
        clearTimeout(cmdHistorySaveTimerRef.current)
        cmdHistorySaveTimerRef.current = null
      }
      if (cmdHistoryLoadedRef.current) {
        window.api.saveCmdHistory(sessionId, recentCommandsRef.current)
      }
      cmdHistoryLoadedRef.current = false
    }
  }, [sessionId])

  useEffect(() => {
    if (!cmdHistoryLoaded) return
    if (cmdHistorySaveTimerRef.current) clearTimeout(cmdHistorySaveTimerRef.current)
    cmdHistorySaveTimerRef.current = setTimeout(() => {
      cmdHistorySaveTimerRef.current = null
      window.api.saveCmdHistory(sessionId, recentCommands)
    }, 800)
    return () => {
      if (cmdHistorySaveTimerRef.current) {
        clearTimeout(cmdHistorySaveTimerRef.current)
        cmdHistorySaveTimerRef.current = null
      }
    }
  }, [recentCommands, cmdHistoryLoaded, sessionId])

  const expandAiFromBar = useCallback(() => {
    onRequestPaneFocusRef.current?.()
    if (termRef.current) setAiSelectedText(termRef.current.getSelection())
    onAiExpandedChange(true)
  }, [onAiExpandedChange])

  /** Cierra el panel IA y devuelve el foco al PTY (si no, el foco queda en la cabecera y no escribe el shell). */
  const collapseAiPanel = useCallback(() => {
    onAiExpandedChange(false)
    queueMicrotask(() => { termRef.current?.focus() })
  }, [onAiExpandedChange])

  /** ⌘I (desde App): expandir / contraer panel IA sobre la terminal. */
  const toggleAiFullscreen = useCallback(() => {
    onRequestPaneFocusRef.current?.()
    if (aiExpanded) {
      collapseAiPanel()
      return
    }
    if (termRef.current) setAiSelectedText(termRef.current.getSelection())
    onAiExpandedChange(true)
  }, [aiExpanded, collapseAiPanel, onAiExpandedChange])

  // Called by AiPanel on each request to get fresh scrollback context
  const getTerminalContext = useCallback((): string => {
    if (!termRef.current) return ''
    return getScrollback(termRef.current, configRef.current.maxContextLines)
  }, [])

  // Keep ref in sync so the effect below can expose it without re-running
  toggleAiFullscreenRef.current = toggleAiFullscreen

  /** IA: Ctrl+U + comando (misma ruta que teclear; limpia prompts copiados del modelo). */
  const injectLineFromAi = useCallback((rawCmd: string) => {
    onRequestPaneFocusRef.current?.()
    const cmd = stripLeadingShellPrompts(rawCmd)
    if (!cmd) return
    ptyInjectRef.current('\x15' + cmd)
    termRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    /** false tras cleanup: evita IPC / rAF / scroll sobre xterm disposed. */
    let termAlive = true

    userLineDraftRef.current = ''

    // Use configRef.current to get the LATEST config at mount time (avoids
    // creating the terminal with CONFIG_DEFAULTS before getConfig() resolves)
    const initialTheme = getTheme(configRef.current.themeId)
    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace',
      fontSize: configRef.current.fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: initialTheme.xterm,
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    const links = new WebLinksAddon((_ev, uri) => {
      void window.api.openExternalUrl(uri).then(r => {
        if (!r.ok) console.warn('[openExternalUrl]', r.error)
      })
    })
    const serialize = new SerializeAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.loadAddon(serialize)
    term.open(containerRef.current)
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      const accel = e.metaKey || e.ctrlKey
      if (!accel || e.altKey || e.shiftKey) return true
      if (e.key !== 'f' && e.key !== 'F' && e.code !== 'KeyF') return true
      e.preventDefault()
      e.stopPropagation()
      queueMicrotask(() => {
        setFindModalOpen(true)
        setFindModalBuffer([])
        setFindModalHistory([])
      })
      return false
    })
    fitTerminalPreserveScroll(term, fit)

    termRef.current = term
    fitRef.current = fit
    serializeAddonRef.current = serialize

    const updateTerminalScrollDown = (): void => {
      if (!termAlive || termRef.current !== term) return
      try {
        const buf = term.buffer.active
        if (buf.type !== 'normal') {
          setTerminalScrollDownVisible(false)
          return
        }
        setTerminalScrollDownVisible(buf.viewportY < buf.baseY)
      } catch {
        setTerminalScrollDownVisible(false)
      }
    }

    /** Rueda / barra del viewport: xterm usa scrollLines(..., suppressScrollEvent: true) y NO dispara `term.onScroll`. */
    let scrollIndicatorRaf = 0
    const scheduleScrollDownIndicator = (): void => {
      if (!termAlive || termRef.current !== term) return
      if (scrollIndicatorRaf !== 0) return
      scrollIndicatorRaf = requestAnimationFrame(() => {
        scrollIndicatorRaf = 0
        if (!termAlive || termRef.current !== term) return
        updateTerminalScrollDown()
      })
    }

    const dScroll = term.onScroll(() => { updateTerminalScrollDown() })
    const dWrite = term.onWriteParsed(() => { updateTerminalScrollDown() })
    const dResize = term.onResize(() => { updateTerminalScrollDown() })
    queueMicrotask(() => { updateTerminalScrollDown() })

    const viewportEl = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement | null
    viewportEl?.addEventListener('scroll', scheduleScrollDownIndicator, { passive: true })

    /** Evita refresh() sobre terminal disposed / distinta instancia (StrictMode, cambio de pestaña). */
    let repaintRaf = 0
    const scheduleTerminalCanvasRepaint = (): void => {
      if (!termAlive || termRef.current !== term || repaintRaf !== 0) return
      repaintRaf = requestAnimationFrame(() => {
        repaintRaf = 0
        if (!termAlive || termRef.current !== term || term.rows < 1) return
        try {
          term.refresh(0, term.rows - 1)
        } catch {
          /* dispose / dimensions */
        }
      })
    }

    // Cargar scrollback persistido antes del primer output del PTY
    void window.api.loadScrollback(sessionId).then(saved => {
      if (!termAlive || !saved) return
      term.write(saved, () => {
        if (!termAlive) return
        scheduleTerminalCanvasRepaint()
      })
    })

    const scheduleScrollbackSave = (): void => {
      if (scrollbackSaveTimerRef.current) clearTimeout(scrollbackSaveTimerRef.current)
      scrollbackSaveTimerRef.current = setTimeout(() => {
        scrollbackSaveTimerRef.current = null
        try {
          const data = serializeAddonRef.current?.serialize()
          if (data) window.api.saveScrollback(sessionId, data)
        } catch { /* ignore */ }
      }, 5000)
    }

    const writeToPty = (data: string): void => { window.api.ptyWrite(sessionId, data) }

    const absorbUserInput = (raw: string): void => {
      const { draft, completedLines } = feedCompletedUserLines(userLineDraftRef.current, raw)
      userLineDraftRef.current = draft
      if (completedLines.length > 0) {
        setCmdSuggestCmd(null)
        setCmdSuggestDraft('')
        // Marcar como ocupado al enviar un comando al PTY
        if (!isBusyRef.current) {
          isBusyRef.current = true
          onBusyChangeRef.current?.(true)
        }
        if (busySilenceTimerRef.current) clearTimeout(busySilenceTimerRef.current)
        busySilenceTimerRef.current = setTimeout(() => {
          busySilenceTimerRef.current = null
          isBusyRef.current = false
          onBusyChangeRef.current?.(false)
        }, 350)
      }
      for (const line of completedLines) {
        window.api.recordCdLine(sessionId, line)
        if (!/^\s*(?:builtin\s+|command\s+)?cd(\s|$)/i.test(line.trim())) {
          setRecentCommands(prev => pushRecentUnique(prev, line, MAX_RECENT_COMMANDS))
        }
        if (/^\s*(?:builtin\s+|command\s+)?cd(\s|$)/i.test(line.trim())) {
          void loadCdPaths()
        }
      }
      const t = draft.trimStart()
      if (isCdStart(t)) {
        setCdDraft(t)
        if (!cdVisibleRef.current) {
          cdVisibleRef.current = true
          void loadCdLocalDirs()
        }
        setCdVisible(true)
        setCmdSuggestCmd(null)
        setCmdSuggestDraft('')
      } else {
        cdVisibleRef.current = false
        setCdVisible(false)
        setCdDraft('')
        setCdLocalDirs([])
        const matched = getMatchedCmd(t)
        if (matched) {
          setCmdSuggestCmd(matched)
          setCmdSuggestDraft(t)
        } else {
          setCmdSuggestCmd(null)
          /* Mantener el borrador para listar “recientes” (pnpm, yarn, etc.). */
          setCmdSuggestDraft(t)
        }
      }
    }
    absorbUserInputRef.current = absorbUserInput

    ptyInjectRef.current = (raw: string): void => {
      absorbUserInput(raw)
      writeToPty(raw)
    }

    onRegisterRef({
      getSelection: () => term.getSelection(),
      writeToTty: (data: string) => {
        onRequestPaneFocusRef.current?.()
        absorbUserInput(data)
        writeToPty(data)
        term.focus()
      },
      toggleAiFullscreen: () => toggleAiFullscreenRef.current(),
      serialize: () => serializeAddonRef.current?.serialize() ?? '',
    })

    term.onData(data => {
      absorbUserInput(data)
      writeToPty(data)
      scheduleTerminalCanvasRepaint()
    })
    term.onTitleChange(title => { if (title && isActivePaneRef.current) onTitleChange(title) })

    const resizeObs = new ResizeObserver(() => {
      if (!termAlive || termRef.current !== term) return
      try {
        fitTerminalPreserveScroll(term, fit)
        const cols = Math.max(1, term.cols)
        const rows = Math.max(1, term.rows)
        window.api.ptyResize(sessionId, cols, rows)
        updateTerminalScrollDown()
      } catch {
        /* syncScrollArea / dimensions durante resize o dispose */
      }
    })
    if (containerRef.current) resizeObs.observe(containerRef.current)

    // Suscribirse ANTES de ptyCreate: la salida inicial del shell no se pierde por carrera IPC.
    const unsubData = window.api.onPtyData(sessionId, data => {
      if (!termAlive || termRef.current !== term) return
      writePtyDataWithFollowScroll(term, data, scheduleTerminalCanvasRepaint)
      scheduleScrollbackSave()
      // Mientras haya salida del PTY, el proceso sigue activo: resetear el timer de silencio
      if (isBusyRef.current) {
        if (busySilenceTimerRef.current) clearTimeout(busySilenceTimerRef.current)
        busySilenceTimerRef.current = setTimeout(() => {
          busySilenceTimerRef.current = null
          isBusyRef.current = false
          onBusyChangeRef.current?.(false)
        }, 350)
      }
    })
    const unsubExit = window.api.onPtyExit(sessionId, code => {
      if (!termAlive || termRef.current !== term) return
      writePtyDataWithFollowScroll(
        term,
        `\r\n\x1b[2m[proceso terminado — código ${code}]\x1b[0m\r\n`,
        scheduleTerminalCanvasRepaint,
      )
      // Sin proceso, ptyWrite no hace nada → no hay eco en xterm; el onData del renderer
      // sigue alimentando sugerencias. Re-lanzar shell en el mismo sessionId si el panel sigue montado.
      void window.api.getSessionCwd(sessionId).then(cwd => {
        const dir = cwd.trim()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!termAlive || termRef.current !== term) return
            const host = containerRef.current
            if (!host?.isConnected) return
            try {
              window.api.ptyCreate(sessionId, dir || undefined)
              fitTerminalPreserveScroll(term, fit)
              const cols = Math.max(1, term.cols)
              const rows = Math.max(1, term.rows)
              window.api.ptyResize(sessionId, cols, rows)
            } catch {
              /* xterm / PTY carrera */
            }
            scheduleTerminalCanvasRepaint()
          })
        })
      })
    })
    const unsubErr = window.api.onPtyError(sessionId, message => {
      if (!termAlive || termRef.current !== term) return
      writePtyDataWithFollowScroll(
        term,
        `\r\n\x1b[31m${message}\x1b[0m\r\n`,
        scheduleTerminalCanvasRepaint,
      )
    })

    window.api.ptyCreate(sessionId, initialPtyCwd?.trim() || undefined)
    window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))

    return () => {
      termAlive = false
      if (scrollIndicatorRaf !== 0) {
        cancelAnimationFrame(scrollIndicatorRaf)
        scrollIndicatorRaf = 0
      }
      viewportEl?.removeEventListener('scroll', scheduleScrollDownIndicator)
      if (repaintRaf !== 0) {
        cancelAnimationFrame(repaintRaf)
        repaintRaf = 0
      }
      absorbUserInputRef.current = () => {}
      ptyInjectRef.current = () => {}
      if (scrollbackSaveTimerRef.current) {
        clearTimeout(scrollbackSaveTimerRef.current)
        scrollbackSaveTimerRef.current = null
      }
      if (busySilenceTimerRef.current) {
        clearTimeout(busySilenceTimerRef.current)
        busySilenceTimerRef.current = null
      }
      if (isBusyRef.current) {
        isBusyRef.current = false
        onBusyChangeRef.current?.(false)
      }
      cdVisibleRef.current = false
      setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
      resizeObs.disconnect()
      unsubData(); unsubExit(); unsubErr()
      dScroll.dispose()
      dWrite.dispose()
      dResize.dispose()
      setTerminalScrollDownVisible(false)
      // Guardar scrollback final antes de desmontar
      try {
        const data = serializeAddonRef.current?.serialize()
        if (data) window.api.saveScrollback(sessionId, data)
      } catch { /* ignore */ }
      serializeAddonRef.current = null
      termRef.current = null
      fitRef.current = null
      term.dispose()
      onRegisterRef(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.theme = getTheme(config.themeId).xterm
    // Force xterm to re-render all glyphs with the new palette
    // (clearTextureAtlas is part of the proposed API, enabled above)
    ;(term as Terminal & { clearTextureAtlas?: () => void }).clearTextureAtlas?.()
    // En Electron/macOS el atlas puede quedar sin repintar; refresh fuerza un frame.
    requestAnimationFrame(() => {
      const t = termRef.current
      if (!t || t.rows < 1 || t !== term) return
      try {
        t.refresh(0, t.rows - 1)
      } catch {
        /* dimensions */
      }
    })
  }, [config.themeId])

  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (term && fit) {
      term.options.fontSize = config.fontSize
      fitTerminalPreserveScroll(term, fit)
      window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
    }
  }, [config.fontSize, sessionId])

  useEffect(() => {
    if (tabActive && isActivePane && fitRef.current && termRef.current) {
      setTimeout(() => {
        const term = termRef.current!
        const fit = fitRef.current!
        fitTerminalPreserveScroll(term, fit)
        window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
        term.focus()
      }, 10)
    }
  }, [tabActive, isActivePane, sessionId])

  useEffect(() => {
    if (!tabActive || !isActivePane || !fitRef.current || !termRef.current) return
    const t = setTimeout(() => {
      const term = termRef.current!
      const fit = fitRef.current!
      fitTerminalPreserveScroll(term, fit)
      window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
    }, 60)
    return () => clearTimeout(t)
  }, [aiExpanded, tabActive, isActivePane, sessionId])

  const handleCdPick = (path: string): void => {
    const cmd = `\x15cd ${shellSingleQuotePosix(path)}\r`
    userLineDraftRef.current = ''
    cdVisibleRef.current = false
    setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
    absorbUserInputRef.current(cmd)
    window.api.ptyWrite(sessionId, cmd)
    termRef.current?.focus()
  }

  const handleCdLocalPick = (dirname: string): void => {
    const cmd = `\x15cd ${shellSingleQuotePosix(dirname)}\r`
    userLineDraftRef.current = ''
    cdVisibleRef.current = false
    setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
    absorbUserInputRef.current(cmd)
    window.api.ptyWrite(sessionId, cmd)
    termRef.current?.focus()
  }

  const cdArg = cdDraft.trimStart().replace(/^cd\s*/i, '').toLowerCase()
  const visiblePaths = cdVisible ? filterPaths(cdPaths, cdDraft) : []
  const visibleLocalDirs = cdVisible
    ? (cdArg ? cdLocalDirs.filter(d => d.toLowerCase().includes(cdArg)) : cdLocalDirs)
    : []

  const handleCmdSnippetPick = (snippet: string): void => {
    // Ctrl+U borra la línea, luego escribe el snippet SIN \r (no ejecuta)
    const toWrite = `\x15${snippet}`
    userLineDraftRef.current = snippet
    const matched = getMatchedCmd(snippet.trimStart())
    if (matched) {
      setCmdSuggestCmd(matched)
      setCmdSuggestDraft(snippet.trimStart())
    } else {
      setCmdSuggestCmd(null)
      setCmdSuggestDraft(snippet.trimStart())
    }
    window.api.ptyWrite(sessionId, toWrite)
    termRef.current?.focus()
  }

  const handleRecentCmdPick = (cmd: string): void => {
    const toWrite = `\x15${cmd}`
    userLineDraftRef.current = cmd
    const matched = getMatchedCmd(cmd.trimStart())
    if (matched) {
      setCmdSuggestCmd(matched)
      setCmdSuggestDraft(cmd.trimStart())
    } else {
      setCmdSuggestCmd(null)
      setCmdSuggestDraft(cmd.trimStart())
    }
    window.api.ptyWrite(sessionId, toWrite)
    termRef.current?.focus()
  }

  const runTerminalFind = useCallback((raw: string) => {
    const q = raw.trim()
    if (!q) return
    const term = termRef.current
    if (!term) {
      setFindModalBuffer([])
      setFindModalHistory([])
      return
    }
    setFindModalBuffer(findMatchesInTerminalBuffer(term, q))
    setFindModalHistory(findMatchesInCommandHistory(recentCommandsRef.current, q))
  }, [])

  const closeFindModal = useCallback(() => {
    setFindModalOpen(false)
    setFindModalBuffer([])
    setFindModalHistory([])
    queueMicrotask(() => { termRef.current?.focus() })
  }, [])

  const onGoToFindBufferMatch = useCallback((m: TerminalBufferFindMatch) => {
    const term = termRef.current
    if (!term) return
    closeFindModal()
    term.scrollToLine(m.lineIndex)
    term.focus()
  }, [closeFindModal])

  const onApplyFindHistoryLine = (line: string): void => {
    setFindModalOpen(false)
    setFindModalBuffer([])
    setFindModalHistory([])
    handleRecentCmdPick(line)
  }

  const handleClearCmdHistory = useCallback((): void => {
    if (cmdHistorySaveTimerRef.current) {
      clearTimeout(cmdHistorySaveTimerRef.current)
      cmdHistorySaveTimerRef.current = null
    }
    setRecentCommands([])
    window.api.deleteCmdHistory(sessionId)
    termRef.current?.focus()
  }, [sessionId])

  const visibleSnippets: CmdSnippet[] = cmdSuggestCmd
    ? filterCmdSnippetsByDraft(CMD_SNIPPETS[cmdSuggestCmd] ?? [], cmdSuggestDraft)
    : []

  const visibleRecentMatches = useMemo(
    () => filterExecutedRecentsByDraft(recentCommands, cmdSuggestDraft, MAX_VISIBLE_RECENT_MATCHES),
    [recentCommands, cmdSuggestDraft],
  )

  const showCmdSuggestPanel = visibleSnippets.length > 0 || visibleRecentMatches.length > 0
  const showCdSuggestPanel = cdVisible && (visibleLocalDirs.length > 0 || cdPaths.length > 0)

  const aiChatZoom =
    (config.fontSize ?? CONFIG_DEFAULTS.fontSize) / CONFIG_DEFAULTS.fontSize

  return (
    <div
      ref={paneRootRef}
      className={[
        'terminal-pane',
        tabActive && isActivePane ? 'terminal-pane--focused' : '',
        tabActive && !isActivePane ? 'terminal-pane--inactive-pane' : '',
      ].filter(Boolean).join(' ')}
      style={{ ['--terminal-pane-ai-chat-zoom' as string]: String(aiChatZoom) } as React.CSSProperties}
    >
      {tabActive && (
        <PaneToolbar
          showReorderHandle={!!paneToolbar?.paneReorder?.enabled}
          isGrabbed={paneToolbar?.paneReorder?.isGrabbed ?? false}
          showClosePane={!!paneToolbar?.onClosePane}
          onDragHandleStart={e => {
            onRequestPaneFocusRef.current?.()
            paneToolbar?.paneReorder?.onDragHandleStart(e)
          }}
          onDragHandleEnd={() => {
            paneToolbar?.paneReorder?.onDragHandleEnd()
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onClosePane={() => {
            onRequestPaneFocusRef.current?.()
            setConfirmClosePaneOpen(true)
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onOpenGitPanel={() => {
            onRequestPaneFocusRef.current?.()
            setGitPanelOpen(true)
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onOpenFolderInFinder={() => {
            onRequestPaneFocusRef.current?.()
            void openThisPaneFolderInFinder()
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onPointerDown={onTerminalChromePointerDown}
        />
      )}

      <div className="terminal-pane-body">
        <div
          className="terminal-pane-main"
          onMouseDown={e => {
            onRequestPaneFocusRef.current?.()
            if ((e.target as HTMLElement).closest('button')) return
            termRef.current?.focus()
          }}
        >
          <div ref={containerRef} className="terminal-container" />

          <TerminalScrollDown
            visible={terminalScrollDownVisible && shellOrToolbarFocused}
            onPointerDown={onTerminalChromePointerDown}
            onClick={() => {
              onRequestPaneFocusRef.current?.()
              termRef.current?.scrollToBottom()
              termRef.current?.focus()
            }}
          />

          <SplitPaneButton
            visible={!!onRequestSplitPane && shellOrToolbarFocused}
            onPointerDown={onTerminalChromePointerDown}
            onClick={() => {
              onRequestPaneFocusRef.current?.()
              onRequestSplitPane?.()
              termRef.current?.focus()
            }}
          />
        </div>

        {(showCdSuggestPanel || showCmdSuggestPanel) && (
          <div className="terminal-suggest-stack">
            {showCdSuggestPanel && (
              <CdSuggest
                visibleLocalDirs={visibleLocalDirs}
                visiblePaths={visiblePaths}
                onPickLocal={handleCdLocalPick}
                onPickRecent={handleCdPick}
              />
            )}
            {showCmdSuggestPanel && (
              <CmdSuggest
                visibleRecentMatches={visibleRecentMatches}
                visibleSnippets={visibleSnippets}
                cmdSuggestCmd={cmdSuggestCmd}
                cmdSuggestDraft={cmdSuggestDraft}
                onPickRecent={handleRecentCmdPick}
                onPickSnippet={handleCmdSnippetPick}
                onClearHistory={handleClearCmdHistory}
              />
            )}
          </div>
        )}
      </div>

      <div
        ref={aiDockRef}
        className={[
          'terminal-pane-ai-dock',
          aiExpanded ? 'terminal-pane-ai-dock--expanded' : 'terminal-pane-ai-dock--collapsed',
        ].filter(Boolean).join(' ')}
      >
        <AiPanel
          config={config}
          sessionId={sessionId}
          selectedText={aiSelectedText}
          getTerminalContext={getTerminalContext}
          onInjectLine={injectLineFromAi}
          onExpand={expandAiFromBar}
          onCollapse={collapseAiPanel}
          expanded={aiExpanded}
          onConfigPatch={onConfigPatch}
        />
      </div>

      <TerminalFindModal
        open={findModalOpen}
        onClose={closeFindModal}
        bufferMatches={findModalBuffer}
        historyMatches={findModalHistory}
        onSearch={runTerminalFind}
        onGoToBufferMatch={onGoToFindBufferMatch}
        onApplyHistoryLine={onApplyFindHistoryLine}
      />

      <ConfirmTerminalModal
        open={confirmClosePaneOpen}
        message="¿Cerrar este panel?"
        detail="Se cerrará la sesión de esta terminal (PTY de esta celda)."
        onConfirm={() => {
          setConfirmClosePaneOpen(false)
          paneToolbar?.onClosePane?.()
        }}
        onCancel={() => setConfirmClosePaneOpen(false)}
      />

      <GitPanelModal
        open={gitPanelOpen}
        sessionId={sessionId}
        config={config}
        onClose={() => {
          setGitPanelOpen(false)
          queueMicrotask(() => { termRef.current?.focus() })
        }}
      />
    </div>
  )
}
