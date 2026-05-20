import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { applyTheme, getTheme, normalizeThemeId } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { i18next } from '@i18n/index'
import { useT } from '@i18n/useT'
import {
  DEFAULT_FILE_EXPLORER_STATE,
  normalizeFileExplorerState,
  type FileExplorerPersistedState,
} from '@shared/fileExplorerPersistedState'
import { TabBar, type TabBarHandle } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { SettingsModal } from './components/SettingsModal'
import { ThemePickerModal } from './components/ThemePickerModal'
import { Titlebar } from './components/Titlebar'
import './styles/app.css'

export interface TabSession {
  id: string
  title: string
  /** Tras renombrar a mano: el título del PTY no sustituye `title` */
  titleLocked?: boolean
  /** Cada panel = una sesión PTY (UUID); como máximo `MAX_PANES_PER_TAB` por pestaña */
  paneIds: string[]
  activePaneId: string
}

/** Máximo de splits por pestaña (layout 2×2). */
export const MAX_PANES_PER_TAB = 4

/**
 * Tras cerrar un panel en una rejilla 2×2 de 4, reordenar supervivientes a
 * [sup-izq, sup-der, inferior-a-ancho-completo] para el layout de 3 paneles.
 * Orden en paneIds con 4: 0=sup-izq, 1=sup-der, 2=inf-izq, 3=inf-der.
 */
function reorderPaneIdsAfterCloseInFourGrid(paneIds: string[], closedPaneId: string): string[] {
  if (paneIds.length !== 4) {
    return paneIds.filter(id => id !== closedPaneId)
  }
  const ci = paneIds.indexOf(closedPaneId)
  if (ci < 0) return paneIds.filter(id => id !== closedPaneId)
  const [tl, tr, bl, br] = paneIds
  if (ci === 3) return [tl, tr, bl]
  if (ci === 2) return [tl, tr, br]
  if (ci === 1) return [tl, br, bl]
  if (ci === 0) return [tr, bl, br]
  return paneIds.filter(id => id !== closedPaneId)
}

function capTabsPaneCount(tabs: TabSession[], maxPanes: number): { tabs: TabSession[]; orphanPaneIds: string[] } {
  const orphanPaneIds: string[] = []
  const out = tabs.map(tab => {
    if (tab.paneIds.length <= maxPanes) return tab
    orphanPaneIds.push(...tab.paneIds.slice(maxPanes))
    const paneIds = tab.paneIds.slice(0, maxPanes)
    const activePaneId = paneIds.includes(tab.activePaneId)
      ? tab.activePaneId
      : paneIds[paneIds.length - 1]!
    return { ...tab, paneIds, activePaneId }
  })
  return { tabs: out, orphanPaneIds }
}

/** Marca que las pestañas ya fueron cargadas desde persistencia (o se creó la primera). */
type SessionReady = { loaded: boolean }

let tabCounter = 0
function newTab(title: string): TabSession {
  const paneId = crypto.randomUUID()
  return {
    id: crypto.randomUUID(),
    title,
    paneIds: [paneId],
    activePaneId: paneId,
  }
}

export const App: React.FC = () => {
  const { t } = useT()
  const [tabs, setTabs] = useState<TabSession[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS)
  const [configReady, setConfigReady] = useState(false)
  const [sessionReady, setSessionReady] = useState<SessionReady>({ loaded: false })
  const [aiExpandedByPane, setAiExpandedByPane] = useState<Record<string, boolean>>({})
  const [explorerByPane, setExplorerByPane] = useState<Record<string, FileExplorerPersistedState>>({})
  const [busyPanes, setBusyPanes] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  /** Reordenar paneles: contexto durante HTML5 DnD (evita cierres obsoletos en dragOver). */
  const paneReorderDragRef = useRef<{ tabId: string; dragPaneId: string } | null>(null)
  const [paneDragOverPaneId, setPaneDragOverPaneId] = useState<string | null>(null)
  const [paneDragSourcePaneId, setPaneDragSourcePaneId] = useState<string | null>(null)
  const termRefs = useRef<Map<string, {
    getSelection: () => string
    writeToTty: (s: string) => void
    toggleAiFullscreen: () => void
    toggleExplorer: () => void
    serialize: () => string
  }>>(new Map())
  const splitSpawnCwdRef = useRef<Map<string, string>>(new Map())
  const cwdsRef = useRef<Record<string, string>>({})
  const aiExpandedByPaneRef = useRef<Record<string, boolean>>({})
  const explorerByPaneRef = useRef<Record<string, FileExplorerPersistedState>>({})
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId

  // Guardar sesión con debounce al cambiar tabs / activeTabId
  const saveSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Resuelve cwd para persistir: IPC, último guardado o cwd de spawn pendiente. */
  const resolvePaneCwdForPersist = useCallback(async (paneId: string): Promise<string> => {
    const fallback =
      cwdsRef.current[paneId]?.trim() ||
      splitSpawnCwdRef.current.get(paneId)?.trim() ||
      ''
    try {
      const cwd = (await window.api.getSessionCwd(paneId)).trim()
      return cwd || fallback
    } catch {
      return fallback
    }
  }, [])

  const rememberPaneCwd = useCallback((paneId: string, cwd: string): void => {
    const dir = cwd.trim()
    if (!dir) return
    cwdsRef.current = { ...cwdsRef.current, [paneId]: dir }
    splitSpawnCwdRef.current.set(paneId, dir)
  }, [])

  const buildSessionSnapshot = useCallback(() => {
    const currentTabs = tabsRef.current
    const currentActiveTabId = activeTabIdRef.current
    if (!currentTabs.length || !currentActiveTabId) return null
    return {
      version: 1 as const,
      activeTabId: currentActiveTabId,
      tabs: currentTabs,
      cwds: { ...cwdsRef.current },
      aiExpandedByPane: { ...aiExpandedByPaneRef.current },
      explorerByPane: { ...explorerByPaneRef.current },
    }
  }, [])

  const saveSessionNow = useCallback(async () => {
    const snapshot = buildSessionSnapshot()
    if (!snapshot) return
    await window.api.saveSession(snapshot)
  }, [buildSessionSnapshot])

  /** Tras `cd`: actualiza cwds y escribe session.json de inmediato. */
  const persistPaneCwdOnCd = useCallback(
    (paneId: string, cwd: string) => {
      rememberPaneCwd(paneId, cwd)
      void saveSessionNow()
    },
    [rememberPaneCwd, saveSessionNow],
  )

  /** Consulta el cwd actual de cada pane via IPC y lo guarda en cwdsRef antes de persistir. */
  const flushCwdsAndSave = useCallback(async () => {
    const currentTabs = tabsRef.current
    const currentActiveTabId = activeTabIdRef.current
    if (!currentTabs.length || !currentActiveTabId) return
    const allPaneIds = currentTabs.flatMap(t => t.paneIds)
    const entries = await Promise.all(
      allPaneIds.map(async paneId => [paneId, await resolvePaneCwdForPersist(paneId)] as const),
    )
    cwdsRef.current = Object.fromEntries(entries)
    await saveSessionNow()
  }, [resolvePaneCwdForPersist, saveSessionNow])

  const scheduleSaveSession = useCallback(() => {
    if (saveSessionTimerRef.current) clearTimeout(saveSessionTimerRef.current)
    saveSessionTimerRef.current = setTimeout(() => {
      void flushCwdsAndSave()
    }, 400)
  }, [flushCwdsAndSave])

  // Load config on mount; theme + fuente se aplican en el efecto siguiente cuando `configReady`
  useEffect(() => {
    window.api.getConfig().then(cfg => {
      const tid = normalizeThemeId(cfg.themeId)
      if (tid !== cfg.themeId) {
        void window.api.setConfig({ themeId: tid })
      }
      setConfig({ ...cfg, themeId: tid })
      setConfigReady(true)
    })
  }, [])

  useEffect(() => {
    if (!configReady) return
    applyTheme(getTheme(config.themeId))
  }, [configReady, config.themeId])

  useEffect(() => {
    if (!configReady) return
    void i18next.changeLanguage(config.language ?? 'en')
  }, [configReady, config.language])

  // Load persisted session on mount
  useEffect(() => {
    window.api.loadSession().then(saved => {
      if (saved?.tabs && saved.tabs.length > 0) {
        const { tabs: cappedTabs, orphanPaneIds } = capTabsPaneCount(saved.tabs, MAX_PANES_PER_TAB)
        const keptPaneIds = new Set(cappedTabs.flatMap(t => t.paneIds))
        for (const pid of orphanPaneIds) {
          window.api.ptyKill(pid)
          splitSpawnCwdRef.current.delete(pid)
          delete cwdsRef.current[pid]
        }
        setTimeout(() => {
          for (const pid of orphanPaneIds) {
            window.api.deleteScrollback(pid)
            window.api.deleteAiChat(pid)
            window.api.deleteCmdHistory(pid)
          }
        }, 0)
        cwdsRef.current = Object.fromEntries(
          Object.entries(saved.cwds ?? {})
            .filter(([id]) => keptPaneIds.has(id))
            .filter(([, cwd]) => Boolean(cwd?.trim())),
        )
        const aiRaw = saved.aiExpandedByPane ?? {}
        const aiMap = Object.fromEntries(
          Object.entries(aiRaw).filter(([id]) => keptPaneIds.has(id)),
        )
        aiExpandedByPaneRef.current = aiMap
        setAiExpandedByPane(aiMap)
        const explorerRaw = saved.explorerByPane ?? {}
        const explorerMap = Object.fromEntries(
          Object.entries(explorerRaw)
            .filter(([id]) => keptPaneIds.has(id))
            .map(([id, st]) => [id, normalizeFileExplorerState(st)]),
        )
        explorerByPaneRef.current = explorerMap
        setExplorerByPane(explorerMap)
        // Pre-cargar cwds guardados en splitSpawnCwdRef para que PTY arranque en la carpeta correcta.
        // Solo entradas no vacías (el operador ?? no atrapa ""; usar || en initialPtyCwd).
        for (const [paneId, cwd] of Object.entries(cwdsRef.current)) {
          if (cwd.trim()) splitSpawnCwdRef.current.set(paneId, cwd)
        }
        setTabs(cappedTabs)
        setActiveTabId(saved.activeTabId)
      } else {
        const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
        setTabs([tab])
        setActiveTabId(tab.id)
      }
      setSessionReady({ loaded: true })
    }).catch(() => {
      const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
      setTabs([tab])
      setActiveTabId(tab.id)
      setSessionReady({ loaded: true })
    })
  }, [])

  // Guardar sesión cuando cambia tabs o activeTabId (solo después de que se cargó la sesión)
  useEffect(() => {
    if (!sessionReady.loaded || !tabs.length) return
    scheduleSaveSession()
  }, [tabs, activeTabId, sessionReady.loaded, scheduleSaveSession])

  // Manejar APP_SAVE_BEFORE_CLOSE: serializar scrollbacks, actualizar cwds y responder
  useEffect(() => {
    return window.api.onSaveBeforeClose(() => {
      void (async () => {
        const scrollbacks: Record<string, string> = {}
        for (const [paneId, ref] of termRefs.current.entries()) {
          try {
            const data = ref.serialize()
            if (data) scrollbacks[paneId] = data
          } catch { /* ignore */ }
        }
        // Consultar cwds actuales antes del guardado final
        const currentTabs = tabsRef.current
        const currentActiveTabId = activeTabIdRef.current
        if (currentTabs.length && currentActiveTabId) {
          const allPaneIds = currentTabs.flatMap(t => t.paneIds)
          const entries = await Promise.all(
            allPaneIds.map(async paneId => [paneId, await resolvePaneCwdForPersist(paneId)] as const),
          )
          cwdsRef.current = Object.fromEntries(entries)
          await window.api.saveSession({
            version: 1,
            activeTabId: currentActiveTabId,
            tabs: currentTabs,
            cwds: cwdsRef.current,
            aiExpandedByPane: { ...aiExpandedByPaneRef.current },
            explorerByPane: { ...explorerByPaneRef.current },
          })
        }
        window.api.sendCloseReady(scrollbacks)
      })()
    })
  }, [resolvePaneCwdForPersist])

  const handleBusyChange = useCallback((paneId: string, busy: boolean) => {
    setBusyPanes(prev => {
      const hasPid = prev.has(paneId)
      if (busy === hasPid) return prev
      const next = new Set(prev)
      if (busy) next.add(paneId)
      else next.delete(paneId)
      return next
    })
  }, [])

  const busyTabIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tab of tabs) {
      if (tab.paneIds.some(pid => busyPanes.has(pid))) ids.add(tab.id)
    }
    return ids
  }, [tabs, busyPanes])

  const handleAiExpandedChange = useCallback((paneId: string, expanded: boolean) => {
    setAiExpandedByPane(prev => {
      const next = { ...prev, [paneId]: expanded }
      aiExpandedByPaneRef.current = next
      return next
    })
    scheduleSaveSession()
  }, [scheduleSaveSession])

  const handleFileExplorerChange = useCallback(
    (paneId: string, state: FileExplorerPersistedState) => {
      setExplorerByPane(prev => {
        const next = { ...prev, [paneId]: state }
        explorerByPaneRef.current = next
        return next
      })
      scheduleSaveSession()
    },
    [scheduleSaveSession],
  )

  const handleAddTab = useCallback(() => {
    const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [t])

  /** ⌘W: mismo modal que la cruz del panel (TerminalPane registra `openConfirm` por paneId). */
  const paneShortcutCloseInterceptors = useRef(new Map<string, () => void>())
  const registerPaneShortcutCloseIntercept = useCallback((paneId: string, openConfirm: () => void) => {
    paneShortcutCloseInterceptors.current.set(paneId, openConfirm)
    return () => {
      paneShortcutCloseInterceptors.current.delete(paneId)
    }
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    const victim = tabsRef.current.find(t => t.id === tabId)
    if (victim) {
      setAiExpandedByPane(ae => {
        const next = { ...ae }
        for (const p of victim.paneIds) delete next[p]
        aiExpandedByPaneRef.current = next
        return next
      })
      setExplorerByPane(ex => {
        const next = { ...ex }
        for (const p of victim.paneIds) delete next[p]
        explorerByPaneRef.current = next
        return next
      })
      const paneIds = [...victim.paneIds]
      for (const pid of paneIds) {
        window.api.ptyKill(pid)
        termRefs.current.delete(pid)
        splitSpawnCwdRef.current.delete(pid)
        delete cwdsRef.current[pid]
      }
      setBusyPanes(prev => {
        if (!paneIds.some(pid => prev.has(pid))) return prev
        const next = new Set(prev)
        paneIds.forEach(pid => next.delete(pid))
        return next
      })
      setTimeout(() => {
        for (const pid of paneIds) {
          window.api.deleteScrollback(pid)
          window.api.deleteAiChat(pid)
          window.api.deleteCmdHistory(pid)
        }
      }, 0)
    }
    setTabs(prev => {
      const next = prev.filter(tab => tab.id !== tabId)
      if (next.length === 0) {
        const fresh = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
        setActiveTabId(fresh.id)
        return [fresh]
      }
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1].id)
      }
      return next
    })
  }, [activeTabId, t])

  const handleClosePane = useCallback((tabId: string, paneId: string) => {
    const t = tabsRef.current.find(x => x.id === tabId)
    if (!t || t.paneIds.length <= 1) return
    setAiExpandedByPane(prev => {
      const next = { ...prev }
      delete next[paneId]
      aiExpandedByPaneRef.current = next
      return next
    })
    setExplorerByPane(prev => {
      const next = { ...prev }
      delete next[paneId]
      explorerByPaneRef.current = next
      return next
    })
    window.api.ptyKill(paneId)
    termRefs.current.delete(paneId)
    splitSpawnCwdRef.current.delete(paneId)
    delete cwdsRef.current[paneId]
    setBusyPanes(prev => {
      if (!prev.has(paneId)) return prev
      const next = new Set(prev)
      next.delete(paneId)
      return next
    })
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab
      const idx = tab.paneIds.indexOf(paneId)
      if (idx < 0) return tab
      const nextPanes = reorderPaneIdsAfterCloseInFourGrid(tab.paneIds, paneId)
      let nextActive = tab.activePaneId
      if (nextActive === paneId) {
        const prefer =
          tab.paneIds[Math.max(0, idx - 1)] ??
          tab.paneIds[Math.min(idx + 1, tab.paneIds.length - 1)]
        nextActive = prefer && nextPanes.includes(prefer) ? prefer : nextPanes[0]!
      }
      return { ...tab, paneIds: nextPanes, activePaneId: nextActive }
    }))
    setTimeout(() => {
      window.api.deleteScrollback(paneId)
      window.api.deleteAiChat(paneId)
      window.api.deleteCmdHistory(paneId)
    }, 0)
  }, [])

  const handleSplitRight = useCallback(async (tabId: string, fromPaneId: string) => {
    const tab = tabsRef.current.find(t => t.id === tabId)
    if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
    let cwd = ''
    try {
      cwd = await window.api.getSessionCwd(fromPaneId)
    } catch {
      /* usar cwd por defecto en main */
    }
    const newPaneId = crypto.randomUUID()
    if (cwd) rememberPaneCwd(newPaneId, cwd)
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
      if (t.paneIds.length >= MAX_PANES_PER_TAB) return t
      const idx = t.paneIds.indexOf(fromPaneId)
      if (idx < 0) return t
      const next = [...t.paneIds]
      next.splice(idx + 1, 0, newPaneId)
      return { ...t, paneIds: next, activePaneId: newPaneId }
    }))
    scheduleSaveSession()
  }, [rememberPaneCwd, scheduleSaveSession])

  const handleFocusPane = useCallback((tabId: string, paneId: string) => {
    setActiveTabId(tabId)
    setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, activePaneId: paneId } : t)))
  }, [])

  const tabBarRef = useRef<TabBarHandle>(null)
  const handleClosePaneRef = useRef(handleClosePane)
  handleClosePaneRef.current = handleClosePane
  const handleSplitRightRef = useRef(handleSplitRight)
  handleSplitRightRef.current = handleSplitRight

  // ⌘W: varios paneles en la pestaña → mismo modal que la cruz; varias pestañas → mismo modal que la cruz de pestaña; una pestaña un panel → ventana
  useEffect(() => {
    return window.api.onShortcutCloseTab(() => {
      const tabList = tabsRef.current
      const aid = activeTabIdRef.current
      const tab = tabList.find(t => t.id === aid)
      if (!tab) return
      if (tab.paneIds.length > 1) {
        const openConfirm = paneShortcutCloseInterceptors.current.get(tab.activePaneId)
        if (openConfirm) {
          openConfirm()
          return
        }
        handleClosePaneRef.current(tab.id, tab.activePaneId)
        return
      }
      if (tabList.length > 1) {
        tabBarRef.current?.requestCloseTab(aid)
        return
      }
      window.close()
    })
  }, [])

  const handleTabTitleChange = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== id) return t
      if (t.titleLocked) return t
      return { ...t, title }
    }))
  }, [])

  const handleRenameTab = useCallback((id: string, name: string) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, title: name, titleLocked: true } : t)))
  }, [])

  const handleReorderTabs = useCallback((dragId: string, dropId: string) => {
    setTabs(prev => {
      const next = [...prev]
      const fromIdx = next.findIndex(t => t.id === dragId)
      const toIdx = next.findIndex(t => t.id === dropId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  const handleReorderPanes = useCallback((tabId: string, dragPaneId: string, dropPaneId: string) => {
    if (dragPaneId === dropPaneId) return
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab
      const panes = [...tab.paneIds]
      const fromIdx = panes.indexOf(dragPaneId)
      const toIdx = panes.indexOf(dropPaneId)
      if (fromIdx < 0 || toIdx < 0) return tab
      const [moved] = panes.splice(fromIdx, 1)
      panes.splice(toIdx, 0, moved)
      return { ...tab, paneIds: panes }
    }))
  }, [])

  const clearPaneReorderDnD = useCallback((): void => {
    paneReorderDragRef.current = null
    setPaneDragOverPaneId(null)
    setPaneDragSourcePaneId(null)
  }, [])

  const onPaneReorderHandleDragStart = useCallback((tabId: string, paneId: string, e: DragEvent): void => {
    paneReorderDragRef.current = { tabId, dragPaneId: paneId }
    setPaneDragSourcePaneId(paneId)
    setPaneDragOverPaneId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', paneId)
    e.dataTransfer.setData('application/x-terminal-pane-id', paneId)
  }, [])

  const onPaneReorderHandleDragEnd = useCallback((): void => {
    clearPaneReorderDnD()
  }, [clearPaneReorderDnD])

  /** Aceptar soltar sobre toda la celda (incl. xterm): dragover en fase captura + dragenter. */
  const onPaneCellDragHover = useCallback((tabId: string, paneId: string, e: DragEvent): void => {
    const d = paneReorderDragRef.current
    if (!d || d.tabId !== tabId) return
    if (d.dragPaneId === paneId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setPaneDragOverPaneId(prev => (prev !== paneId ? paneId : prev))
  }, [])

  const onPaneCellDrop = useCallback((tabId: string, dropPaneId: string, e: DragEvent): void => {
    e.preventDefault()
    const d = paneReorderDragRef.current
    clearPaneReorderDnD()
    if (!d || d.tabId !== tabId) return
    if (d.dragPaneId === dropPaneId) return
    handleReorderPanes(tabId, d.dragPaneId, dropPaneId)
  }, [clearPaneReorderDnD, handleReorderPanes])

  const onPaneCellDragLeave = useCallback((paneId: string): void => {
    setPaneDragOverPaneId(prev => (prev === paneId ? null : prev))
  }, [])

  const handleThemeChange = useCallback((themeId: string) => {
    const updated = { ...config, themeId }
    setConfig(updated)
    window.api.setConfig({ themeId })
  }, [config])

  const handleConfigSaved = useCallback((cfg: AppConfig) => {
    setConfig(cfg)
  }, [])

  /** Devuelve foco al xterm de la pestaña activa (p. ej. tras modales o botones con tabIndex -1). */
  const focusActiveTerminalTextarea = useCallback((): void => {
    queueMicrotask(() => {
      document
        .querySelector<HTMLTextAreaElement>(
          '.tab-terminal-group--active .xterm-helper-textarea',
        )
        ?.focus()
    })
  }, [])

  const patchConfig = useCallback(async (partial: Partial<AppConfig>) => {
    const r = await window.api.setConfig(partial)
    if (r.ok) {
      const cfg = await window.api.getConfig()
      setConfig(cfg)
    }
  }, [])

  const MIN_FONT = 9
  const MAX_FONT = 24

  const changeFontSize = useCallback((delta: number) => {
    setConfig(prev => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, (prev.fontSize ?? 13) + delta))
      if (next === prev.fontSize) return prev
      window.api.setConfig({ fontSize: next })
      return { ...prev, fontSize: next }
    })
  }, [])

  // Atajos de teclado globales (captura en fase de bajada para que funcionen con foco en xterm)
  useEffect(() => {
    /**
     * ⌘I: no bloquear si el foco está en el chat IA (p. ej. textarea), para poder colapsar
     * con el mismo atajo. Sí bloquear en otros campos (ajustes, etc.).
     */
    const shouldBlockAiToggleShortcut = (ev: KeyboardEvent): boolean => {
      const target = ev.target as HTMLElement | null
      if (!target) return false
      if (target.closest('.xterm')) return false
      if (target.closest('.ai-panel')) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    const isFocusInFileExplorer = (): boolean => {
      const focus = document.activeElement
      return focus instanceof HTMLElement && focus.closest('.terminal-file-explorer') !== null
    }

    /** Bloquea ⌘E fuera de xterm y del explorador (p. ej. ajustes, otros modales). */
    const shouldBlockExplorerToggleShortcut = (target: HTMLElement | null): boolean => {
      if (isFocusInFileExplorer()) return false
      if (!target || target.closest('.xterm')) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      const accel = e.metaKey || e.ctrlKey
      if (!accel) return

      const isI = e.key === 'i' || e.key === 'I' || e.code === 'KeyI'

      // ⌘I / Ctrl+I: alternar chat IA a pantalla completa ↔ colapsado (panel activo)
      if (!e.altKey && !e.shiftKey && isI) {
        if (shouldBlockAiToggleShortcut(e)) return
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab) return
        termRefs.current.get(tab.activePaneId)?.toggleAiFullscreen()
        return
      }

      if (e.altKey || e.shiftKey) return

      // ⌘E / Ctrl+E: explorador de archivos (panel activo)
      if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        if (isFocusInFileExplorer()) return
        if (shouldBlockExplorerToggleShortcut(e.target as HTMLElement | null)) return
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab) return
        termRefs.current.get(tab.activePaneId)?.toggleExplorer()
        return
      }

      // ⌘T / Ctrl+T: nueva pestaña
      if (e.key === 't' || e.key === 'T' || e.code === 'KeyT') {
        const target = e.target as HTMLElement | null
        if (target && !target.closest('.xterm')) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        handleAddTab()
        return
      }

      // ⌘Y / Ctrl+Y: otra terminal a la derecha (misma pestaña)
      if (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY') {
        const target = e.target as HTMLElement | null
        if (target && !target.closest('.xterm')) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
        void handleSplitRightRef.current(tab.id, tab.activePaneId)
        return
      }

      // ⌘1–9: cambiar a la pestaña en esa posición
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        e.preventDefault()
        e.stopPropagation()
        const target = tabsRef.current[digit - 1]
        if (target) setActiveTabId(target.id)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleAddTab])

  const renderPaneCell = (tab: TabSession, paneId: string, layoutSlotClass?: string): React.ReactElement => (
    <div
      key={paneId}
      className={[
        'tab-terminal-pane-cell',
        layoutSlotClass,
        tab.paneIds.length > 1 && paneDragOverPaneId === paneId ? 'tab-terminal-pane-cell--drag-over' : '',
      ].filter(Boolean).join(' ')}
      {...(tab.paneIds.length > 1
        ? {
            onDragEnter: (e: DragEvent) => { onPaneCellDragHover(tab.id, paneId, e) },
            onDragOverCapture: (e: DragEvent) => { onPaneCellDragHover(tab.id, paneId, e) },
            onDrop: (e: DragEvent) => { onPaneCellDrop(tab.id, paneId, e) },
            onDragLeave: () => { onPaneCellDragLeave(paneId) },
          }
        : {})}
    >
      <TerminalPane
        sessionId={paneId}
        aiExpanded={aiExpandedByPane[paneId] ?? false}
        onAiExpandedChange={expanded => handleAiExpandedChange(paneId, expanded)}
        fileExplorer={explorerByPane[paneId] ?? DEFAULT_FILE_EXPLORER_STATE}
        onFileExplorerChange={state => handleFileExplorerChange(paneId, state)}
        tabActive={tab.id === activeTabId}
        isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
        initialPtyCwd={splitSpawnCwdRef.current.get(paneId) || cwdsRef.current[paneId] || undefined}
        onPtyCwdInitialized={rememberPaneCwd}
        onPaneCwdChanged={persistPaneCwdOnCd}
        paneToolbar={{
          onClosePane: tab.paneIds.length > 1 ? () => handleClosePane(tab.id, paneId) : undefined,
          paneReorder:
            tab.id === activeTabId && tab.paneIds.length > 1
              ? {
                  enabled: true,
                  isGrabbed: paneDragSourcePaneId === paneId,
                  onDragHandleStart: e => { onPaneReorderHandleDragStart(tab.id, paneId, e) },
                  onDragHandleEnd: onPaneReorderHandleDragEnd,
                }
              : undefined,
        }}
        registerShortcutCloseInterceptor={
          tab.paneIds.length > 1
            ? openConfirm => registerPaneShortcutCloseIntercept(paneId, openConfirm)
            : undefined
        }
        onRequestSplitPane={
          tab.id === activeTabId && tab.activePaneId === paneId && tab.paneIds.length < MAX_PANES_PER_TAB
            ? () => { void handleSplitRight(tab.id, paneId) }
            : undefined
        }
        onRequestPaneFocus={() => handleFocusPane(tab.id, paneId)}
        config={config}
        onConfigPatch={patchConfig}
        onTitleChange={title => handleTabTitleChange(tab.id, title)}
        onBusyChange={busy => handleBusyChange(paneId, busy)}
        onRegisterRef={ref => {
          if (ref) termRefs.current.set(paneId, ref)
          else termRefs.current.delete(paneId)
        }}
      />
    </div>
  )

  return (
    <div className="app-root">
      {/* ── Title bar (macOS traffic lights live here) ── */}
      <Titlebar
        config={config}
        fontSize={config.fontSize ?? 13}
        fontSizeMin={MIN_FONT}
        fontSizeMax={MAX_FONT}
        themePickerOpen={themePickerOpen}
        onFontIncrease={() => changeFontSize(1)}
        onFontDecrease={() => changeFontSize(-1)}
        onOpenThemePicker={() => setThemePickerOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ── Tab bar ── */}
      <TabBar
        ref={tabBarRef}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onClose={handleCloseTab}
        onRename={handleRenameTab}
        onReorder={handleReorderTabs}
        busyTabIds={busyTabIds}
      />

      {/* ── Main area ── */}
      <div className="main-area">
        <div className="terminals-container">
          {configReady && sessionReady.loaded && tabs.map(tab => {
            const p = tab.paneIds
            const n = p.length
            const layoutClass =
              n <= 1 ? 'tab-terminal-group--panes-1'
              : n === 2 ? 'tab-terminal-group--panes-2'
              : n === 3 ? 'tab-terminal-group--panes-3'
              : 'tab-terminal-group--panes-4'

            let inner: React.ReactNode
            if (n === 0) {
              inner = null
            } else if (n === 1) {
              inner = renderPaneCell(tab, p[0]!)
            } else if (n === 2) {
              inner = <>{p.map(pid => renderPaneCell(tab, pid))}</>
            } else if (n === 3) {
              inner = <>{p.map((paneId, idx) => renderPaneCell(tab, paneId, `tab-terminal-pane-cell--slot-3-${idx}`))}</>
            } else {
              inner = <>{p.map(pid => renderPaneCell(tab, pid))}</>
            }

            return (
              <div
                key={tab.id}
                className={[
                  'tab-terminal-group',
                  tab.id === activeTabId ? 'tab-terminal-group--active' : '',
                  layoutClass,
                ].filter(Boolean).join(' ')}
              >
                {inner}
              </div>
            )
          })}
        </div>

      </div>

      {settingsOpen && (
        <SettingsModal
          config={config}
          onSave={handleConfigSaved}
          onClose={() => {
            setSettingsOpen(false)
            focusActiveTerminalTextarea()
          }}
        />
      )}

      <ThemePickerModal
        open={themePickerOpen}
        currentThemeId={config.themeId}
        onSelectTheme={handleThemeChange}
        onClose={() => {
          setThemePickerOpen(false)
          focusActiveTerminalTextarea()
        }}
      />
    </div>
  )
}
