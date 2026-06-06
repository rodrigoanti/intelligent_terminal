/**
 * @vitest-environment jsdom
 */
import React, { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useAiMessagesFollowScroll } from '../ai/useAiMessagesFollowScroll'

function ScrollHarness({
  initial,
}: {
  initial: Array<{ id: string; isStreaming?: boolean }>
}): React.ReactElement {
  const [messages, setMessages] = useState(initial)
  const scrollRef = useRef<HTMLDivElement>(null)

  useAiMessagesFollowScroll(messages, true, scrollRef)

  return (
    <div>
      <div
        ref={scrollRef}
        data-testid="messages"
        style={{ height: 100, overflow: 'auto' }}
      >
        <div style={{ height: 2000 }}>content</div>
      </div>
      <button
        type="button"
        onClick={() => setMessages([{ id: '1', isStreaming: false }])}
      >
        end-stream
      </button>
      <button
        type="button"
        onClick={() => setMessages([{ id: '1', isStreaming: true }])}
      >
        start-stream
      </button>
      <button
        type="button"
        onClick={() => setMessages([{ id: '1-updated', isStreaming: false }])}
      >
        update-idle
      </button>
    </div>
  )
}

describe('useAiMessagesFollowScroll', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('scrolls to bottom when streaming ends', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true })
    el.scrollTop = 0

    await act(async () => {
      getByText('end-stream').click()
    })

    expect(el.scrollTop).toBe(1900)
  })

  it('does not scroll when idle and user is reading history', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: false }]} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true })
    el.scrollTop = 100

    await act(async () => {
      getByText('update-idle').click()
    })

    expect(el.scrollTop).toBe(100)
  })
})
