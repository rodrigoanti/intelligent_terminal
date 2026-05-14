import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, getTheme, themePreviewGradient } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { TabBar } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { SettingsModal } from './components/SettingsModal'
import { ThemePickerModal } from './components/ThemePickerModal'
import './styles/app.css'

export interface TabSession {
  id: string
  title: string
  /** Tras renombrar a mano: el título del PTY no sustituye `title` */
  titleLocked?: boolean
  /** Cada panel = una sesión PTY (UUID); la pestaña puede tener varios en fila */
  paneIds: string[]
  activePaneId: string
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
  const termRefs = useRef<Map<string, { getSelection: () => string; writeToTty: (s: string) => void; toggleAi: () => void; serialize: () => string }>>(new Map())
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
    window.api.saveSession({
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

  // Load config + apply saved theme on mount; hold terminal mounting until ready
  useEffect(() => {
    window.api.getConfig().then(cfg => {
      setConfig(cfg)
      applyTheme(getTheme(cfg.themeId))
      setConfigReady(true)
    })
  }, [])

  // Load persisted session on mount
  useEffect(() => {
    window.api.loadSession().then(saved => {
      if (saved && saved.tabs.length > 0) {
        cwdsRef.current = saved.cwds ?? {}
        const aiMap = saved.aiExpandedByPane ?? {}
        aiExpandedByPaneRef.current = aiMap
        setAiExpandedByPane(aiMap)
        // Pre-cargar cwds guardados en splitSpawnCwdRef para que PTY arranque en la carpeta correcta
        for (const [paneId, cwd] of Object.entries(saved.cwds ?? {})) {
          splitSpawnCwdRef.current.set(paneId, cwd)
        }
        setTabs(saved.tabs)
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
          window.api.saveSession({
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

  const handleThemeChange = useCallback((themeId: string) => {
    const theme = getTheme(themeId)
    applyTheme(theme)
    const updated = { ...config, themeId }
    setConfig(updated)
    window.api.setConfig({ themeId })
  }, [config])

  const handleConfigSaved = useCallback((cfg: AppConfig) => {
    setConfig(cfg)
    applyTheme(getTheme(cfg.themeId))
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
    const onKeyDown = (e: KeyboardEvent): void => {
      const accel = e.metaKey || e.ctrlKey
      if (!accel || e.altKey || e.shiftKey) return

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
        if (!tab) return
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

  return (
    <div className="app-root">
      {/* ── Title bar (macOS traffic lights live here) ── */}
      <div className="titlebar">
        <div className="titlebar-drag" />
        <div className="titlebar-actions">
          {/* Font size buttons */}
          <button
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
            className="theme-picker-trigger"
            onClick={() => setThemePickerOpen(true)}
            title="Elegir tema"
            aria-haspopup="dialog"
            aria-expanded={themePickerOpen}
          >
            <span
              className="theme-picker-trigger-swatch"
              style={{ background: themePreviewGradient(getTheme(config.themeId)) }}
              aria-hidden
            />
            <span className="theme-picker-trigger-label">{getTheme(config.themeId).name}</span>
          </button>

          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Ajustes">
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
          {configReady && sessionReady.loaded && tabs.map(tab => (
            <div
              key={tab.id}
              className={[
                'tab-terminal-group',
                tab.id === activeTabId ? 'tab-terminal-group--active' : '',
              ].filter(Boolean).join(' ')}
            >
              {tab.paneIds.map(paneId => (
                <div key={paneId} className="tab-terminal-pane-cell">
                  <TerminalPane
                    sessionId={paneId}
                    aiExpanded={aiExpandedByPane[paneId] ?? false}
                    onAiExpandedChange={expanded => handleAiExpandedChange(paneId, expanded)}
                    tabActive={tab.id === activeTabId}
                    isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
                    initialPtyCwd={splitSpawnCwdRef.current.get(paneId)}
                    paneToolbar={{
                      onClosePane: tab.paneIds.length > 1 ? () => handleClosePane(tab.id, paneId) : undefined,
                    }}
                    onRequestSplitPane={
                      tab.id === activeTabId && tab.activePaneId === paneId
                        ? () => { void handleSplitRight(tab.id, paneId) }
                        : undefined
                    }
                    onRequestPaneFocus={() => handleFocusPane(tab.id, paneId)}
                    config={config}
                    onTitleChange={title => handleTabTitleChange(tab.id, title)}
                    onBusyChange={busy => handleBusyChange(paneId, busy)}
                    onRegisterRef={ref => {
                      if (ref) termRefs.current.set(paneId, ref)
                      else termRefs.current.delete(paneId)
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>

      {settingsOpen && (
        <SettingsModal
          config={config}
          onSave={handleConfigSaved}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <ThemePickerModal
        open={themePickerOpen}
        currentThemeId={config.themeId}
        onSelect={handleThemeChange}
        onClose={() => setThemePickerOpen(false)}
      />
    </div>
  )
}
