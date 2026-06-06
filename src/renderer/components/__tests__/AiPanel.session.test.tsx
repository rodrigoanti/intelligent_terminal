/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { initI18n } from '@i18n/index'
import { AiPanel } from '../AiPanel'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import '../AiPanel.css'

const config = CONFIG_DEFAULTS

function makeApi(sessionId: string) {
  return {
    loadAiChat: vi.fn(async () => [{
      id: `msg-${sessionId}`,
      role: 'user' as const,
      content: `chat-${sessionId}`,
    }]),
    loadInteractionsLog: vi.fn(async () => []),
    saveAiChat: vi.fn(),
    saveInteractionsLog: vi.fn(),
    getAgentFolderTree: vi.fn(async () => ''),
    readAgentMd: vi.fn(async () => null),
    writeAgentMd: vi.fn(async () => ({ ok: true as const })),
    getProjectAiContext: vi.fn(async () => null),
    onGitStatusChanged: vi.fn(() => () => {}),
  }
}

describe('AiPanel session switch', () => {
  beforeEach(async () => {
    await initI18n('en')
    vi.stubGlobal('api', undefined)
  })

  it('clears loaded chat when sessionId changes', async () => {
    const apiA = makeApi('session-a')
    const apiB = makeApi('session-b')
    ;(window as unknown as { api: typeof apiA }).api = apiA

    const { rerender, container } = render(
      <AiPanel
        config={config}
        sessionId="session-a"
        selectedText=""
        getTerminalContext={() => ''}
        onInjectLine={() => {}}
        onCollapse={() => {}}
        onExpand={() => {}}
        expanded
      />,
    )

    await waitFor(() => {
      expect(apiA.loadAiChat).toHaveBeenCalledWith('session-a')
      expect(container.textContent).toContain('chat-session-a')
    })

    ;(window as unknown as { api: typeof apiB }).api = apiB
    rerender(
      <AiPanel
        config={config}
        sessionId="session-b"
        selectedText=""
        getTerminalContext={() => ''}
        onInjectLine={() => {}}
        onCollapse={() => {}}
        onExpand={() => {}}
        expanded
      />,
    )

    await waitFor(() => {
      expect(apiB.loadAiChat).toHaveBeenCalledWith('session-b')
    })

    expect(container.textContent).not.toContain('chat-session-a')
  })
})
