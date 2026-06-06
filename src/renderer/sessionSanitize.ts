import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type { TabSession } from './App'
import { normalizeTabSession } from './tabSplitSizes'

export interface PersistedSessionInput {
  version: 1
  activeTabId: string
  tabs: TabSession[]
  cwds: Record<string, string>
  aiExpandedByPane?: Record<string, boolean>
  explorerByPane?: Record<string, FileExplorerPersistedState>
}

export interface SanitizedSession {
  tabs: TabSession[]
  activeTabId: string
  cwds: Record<string, string>
  aiExpandedByPane: Record<string, boolean>
  explorerByPane: Record<string, FileExplorerPersistedState>
  orphanPaneIds: string[]
}

function sanitizeTab(tab: TabSession): TabSession | null {
  if (!tab?.id || !Array.isArray(tab.paneIds) || tab.paneIds.length === 0) return null
  const paneIds = tab.paneIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (paneIds.length === 0) return null
  const activePaneId = paneIds.includes(tab.activePaneId)
    ? tab.activePaneId
    : paneIds[paneIds.length - 1]!
  return normalizeTabSession({
    ...tab,
    title: typeof tab.title === 'string' && tab.title.trim() ? tab.title : 'Terminal',
    paneIds,
    activePaneId,
  })
}

/** Derive next tab counter from persisted tab titles like "Terminal 3". */
export function deriveTabCounter(tabs: TabSession[]): number {
  let max = tabs.length
  for (const tab of tabs) {
    const m = /(\d+)\s*$/.exec(tab.title)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

export function sanitizePersistedSession(saved: PersistedSessionInput): SanitizedSession | null {
  const rawTabs = Array.isArray(saved.tabs) ? saved.tabs : []
  const tabs = rawTabs
    .map(t => sanitizeTab(t as TabSession))
    .filter((t): t is TabSession => t !== null)

  if (tabs.length === 0) return null

  const keptPaneIds = new Set(tabs.flatMap(t => t.paneIds))
  const activeTabId = tabs.some(t => t.id === saved.activeTabId)
    ? saved.activeTabId
    : tabs[0]!.id

  const cwds = Object.fromEntries(
    Object.entries(saved.cwds ?? {})
      .filter(([id]) => keptPaneIds.has(id))
      .filter(([, cwd]) => Boolean(cwd?.trim())),
  )

  const aiExpandedByPane = Object.fromEntries(
    Object.entries(saved.aiExpandedByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )

  const explorerByPane = Object.fromEntries(
    Object.entries(saved.explorerByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )

  const allSavedPaneIds = new Set(
    rawTabs.flatMap(t => (Array.isArray((t as TabSession).paneIds) ? (t as TabSession).paneIds : [])),
  )
  const orphanPaneIds = [...allSavedPaneIds].filter(id => !keptPaneIds.has(id))

  return { tabs, activeTabId, cwds, aiExpandedByPane, explorerByPane, orphanPaneIds }
}
