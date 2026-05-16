import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { applyTheme, getTheme, normalizeThemeId } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { TabBar } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { SettingsModal } from './components/SettingsModal'
import { ThemePickerModal } from './components/ThemePickerModal'
import { TitlebarMusicControls } from './components/TitlebarMusicControls'
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
function newTab(): TabSession {
  tabCounter++
  const paneId = crypto.randomUUID()
  return {
    id: crypto.randomUUID(),
    title: `Shell ${tabCounter}`,
    paneIds: [paneId],
    activePaneId: paneId,
  }
}

export const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabSession[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS)
  const [configReady, setConfigReady] = useState(false)
  const [sessionReady, setSessionReady] = useState<SessionReady>({ loaded: false })
  const [aiExpandedByPane, setAiExpandedByPane] = useState<Record<string, boolean>>({})
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
    serialize: () => string
  }>>(new Map())
  const splitSpawnCwdRef = useRef<Map<string, string>>(new Map())
  const cwdsRef = useRef<Record<string, string>>({})
  const aiExpandedByPaneRef = useRef<Record<string, boolean>>({})
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId

  // Guardar sesión con debounce al cambiar tabs / activeTabId
  const saveSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Consulta el cwd actual de cada pane via IPC y lo guarda en cwdsRef antes de persistir. */
  const flushCwdsAndSave = useCallback(async () => {
    const currentTabs = tabsRef.current
    const currentActiveTabId = activeTabIdRef.current
    if (!currentTabs.length || !currentActiveTabId) return
    const allPaneIds = currentTabs.flatMap(t => t.paneIds)
    const entries = await Promise.all(
      allPaneIds.map(async paneId => {
        try {
          const cwd = await window.api.getSessionCwd(paneId)
          return [paneId, cwd] as [string, string]
        } catch {
          return [paneId, cwdsRef.current[paneId] ?? ''] as [string, string]
        }
      })
    )
    cwdsRef.current = Object.fromEntries(entries)
    await window.api.saveSession({
      version: 1,
      activeTabId: currentActiveTabId,
      tabs: currentTabs,
      cwds: cwdsRef.current,
      aiExpandedByPane: { ...aiExpandedByPaneRef.current },
    })
  }, [])

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

  // Load persisted session on mount
  useEffect(() => {
    window.api.loadSession().then(saved => {
      if (saved && saved.tabs.length > 0) {
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
          Object.entries(saved.cwds ?? {}).filter(([id]) => keptPaneIds.has(id)),
        )
        const aiRaw = saved.aiExpandedByPane ?? {}
        const aiMap = Object.fromEntries(
          Object.entries(aiRaw).filter(([id]) => keptPaneIds.has(id)),
        )
        aiExpandedByPaneRef.current = aiMap
        setAiExpandedByPane(aiMap)
        // Pre-cargar cwds guardados en splitSpawnCwdRef para que PTY arranque en la carpeta correcta
        for (const [paneId, cwd] of Object.entries(cwdsRef.current)) {
          splitSpawnCwdRef.current.set(paneId, cwd)
        }
        setTabs(cappedTabs)
        setActiveTabId(saved.activeTabId)
      } else {
        const t = newTab()
        setTabs([t])
        setActiveTabId(t.id)
      }
      setSessionReady({ loaded: true })
    }).catch(() => {
      const t = newTab()
      setTabs([t])
      setActiveTabId(t.id)
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
            allPaneIds.map(async paneId => {
              try {
                const cwd = await window.api.getSessionCwd(paneId)
                return [paneId, cwd] as [string, string]
              } catch {
                return [paneId, cwdsRef.current[paneId] ?? ''] as [string, string]
              }
            })
          )
          cwdsRef.current = Object.fromEntries(entries)
          await window.api.saveSession({
            version: 1,
            activeTabId: currentActiveTabId,
            tabs: currentTabs,
            cwds: cwdsRef.current,
            aiExpandedByPane: { ...aiExpandedByPaneRef.current },
          })
        }
        window.api.sendCloseReady(scrollbacks)
      })()
    })
  }, [])

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

  const handleAddTab = useCallback(() => {
    const tab = newTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
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
      const next = prev.filter(t => t.id !== tabId)
      if (next.length === 0) {
        const fresh = newTab()
        setActiveTabId(fresh.id)
        return [fresh]
      }
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1].id)
      }
      return next
    })
  }, [activeTabId])

  const handleClosePane = useCallback((tabId: string, paneId: string) => {
    const t = tabsRef.current.find(x => x.id === tabId)
    if (!t || t.paneIds.length <= 1) return
    setAiExpandedByPane(prev => {
      const next = { ...prev }
      delete next[paneId]
      aiExpandedByPaneRef.current = next
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
      const nextPanes = tab.paneIds.filter(p => p !== paneId)
      let nextActive = tab.activePaneId
      if (nextActive === paneId) {
        nextActive = nextPanes[Math.max(0, idx - 1)] ?? nextPanes[0]
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
    if (cwd) splitSpawnCwdRef.current.set(newPaneId, cwd)
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
      if (t.paneIds.length >= MAX_PANES_PER_TAB) return t
      const idx = t.paneIds.indexOf(fromPaneId)
      if (idx < 0) return t
      const next = [...t.paneIds]
      next.splice(idx + 1, 0, newPaneId)
      return { ...t, paneIds: next, activePaneId: newPaneId }
    }))
  }, [])

  const handleFocusPane = useCallback((tabId: string, paneId: string) => {
    setActiveTabId(tabId)
    setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, activePaneId: paneId } : t)))
  }, [])

  const handleCloseTabRef = useRef(handleCloseTab)
  handleCloseTabRef.current = handleCloseTab
  const handleClosePaneRef = useRef(handleClosePane)
  handleClosePaneRef.current = handleClosePane
  const handleSplitRightRef = useRef(handleSplitRight)
  handleSplitRightRef.current = handleSplitRight

  // ⌘W: varios paneles en la pestaña → cerrar panel activo; varias pestañas → cerrar pestaña; una pestaña un panel → ventana
  useEffect(() => {
    return window.api.onShortcutCloseTab(() => {
      const tabList = tabsRef.current
      const aid = activeTabIdRef.current
      const tab = tabList.find(t => t.id === aid)
      if (!tab) return
      if (tab.paneIds.length > 1) {
        handleClosePaneRef.current(tab.id, tab.activePaneId)
        return
      }
      if (tabList.length > 1) {
        handleCloseTabRef.current(aid)
      } else {
        window.close()
      }
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
        tabActive={tab.id === activeTabId}
        isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
        initialPtyCwd={splitSpawnCwdRef.current.get(paneId)}
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
      <div className="titlebar">
        <div className="titlebar-drag" />
        <div className="titlebar-actions">
          <TitlebarMusicControls
            config={config}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {/* Font size buttons */}
          <button
            type="button"
            tabIndex={-1}
            className="icon-btn font-size-btn"
            onClick={() => changeFontSize(-1)}
            disabled={(config.fontSize ?? 13) <= MIN_FONT}
            title="Reducir tamaño de letra"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="icon-btn font-size-btn"
            onClick={() => changeFontSize(1)}
            disabled={(config.fontSize ?? 13) >= MAX_FONT}
            title="Aumentar tamaño de letra"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>

          {/* Selector de tema (modal con vista previa) */}
          <button
            type="button"
            tabIndex={-1}
            className="theme-picker-trigger"
            onClick={() => setThemePickerOpen(true)}
            title="Elegir tema"
            aria-haspopup="dialog"
            aria-expanded={themePickerOpen}
          >
            <span className="theme-picker-trigger-palette" aria-hidden>
              <span
                className="theme-picker-trigger-swatch-bg"
                style={{ background: getTheme(config.themeId).vars['--bg'] ?? getTheme(config.themeId).xterm.background }}
              />
              <span
                className="theme-picker-trigger-swatch-accent"
                style={{ background: getTheme(config.themeId).vars['--accent'] ?? getTheme(config.themeId).xterm.cursor }}
              />
            </span>
            <span className="theme-picker-trigger-label">{getTheme(config.themeId).name}</span>
          </button>

          <button type="button" tabIndex={-1} className="icon-btn" onClick={() => setSettingsOpen(true)} title="Ajustes">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <TabBar
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
