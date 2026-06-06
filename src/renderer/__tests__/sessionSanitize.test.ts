import { describe, expect, it } from 'vitest'
import { deriveTabCounter, sanitizePersistedSession } from '../sessionSanitize'
import type { TabSession } from '../App'

function tab(id: string, paneId: string, title = 'Terminal 1'): TabSession {
  return { id, title, paneIds: [paneId], activePaneId: paneId }
}

describe('sanitizePersistedSession', () => {
  it('filters tabs with empty paneIds', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [
        tab('t1', 'p1'),
        { id: 't2', title: 'Empty', paneIds: [], activePaneId: '' },
      ],
      cwds: {},
    })
    expect(result?.tabs).toHaveLength(1)
    expect(result?.activeTabId).toBe('t1')
  })

  it('falls back activeTabId when invalid', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 'missing',
      tabs: [tab('t1', 'p1'), tab('t2', 'p2', 'Terminal 2')],
      cwds: {},
    })
    expect(result?.activeTabId).toBe('t1')
  })

  it('fixes orphan activePaneId', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{ id: 't1', title: 'T', paneIds: ['p1'], activePaneId: 'orphan' }],
      cwds: {},
    })
    expect(result?.tabs[0]?.activePaneId).toBe('p1')
  })

  it('returns null when no valid tabs', () => {
    expect(sanitizePersistedSession({
      version: 1,
      activeTabId: 'x',
      tabs: [],
      cwds: {},
    })).toBeNull()
  })
})

describe('deriveTabCounter', () => {
  it('uses max number from titles', () => {
    expect(deriveTabCounter([
      tab('a', 'p1', 'Terminal 2'),
      tab('b', 'p2', 'Terminal 7'),
    ])).toBe(7)
  })
})
