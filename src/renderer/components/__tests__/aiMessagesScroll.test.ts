/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAiMessagesMaxScrollTop,
  isAiMessagesNearBottom,
  scrollAiMessagesToBottom,
} from '../ai/aiMessagesScroll'

function makeScrollEl(opts: {
  scrollHeight: number
  clientHeight: number
  scrollTop?: number
}): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { value: opts.scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: opts.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', {
    value: opts.scrollTop ?? 0,
    writable: true,
    configurable: true,
  })
  return el
}

describe('aiMessagesScroll', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getAiMessagesMaxScrollTop never returns negative values', () => {
    const el = makeScrollEl({ scrollHeight: 200, clientHeight: 300 })
    expect(getAiMessagesMaxScrollTop(el)).toBe(0)
  })

  it('isAiMessagesNearBottom respects threshold', () => {
    const el = makeScrollEl({ scrollHeight: 1000, clientHeight: 400, scrollTop: 580 })
    expect(isAiMessagesNearBottom(el)).toBe(true)
    Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })
    expect(isAiMessagesNearBottom(el)).toBe(false)
  })

  it('scrollAiMessagesToBottom clamps before moving when content shrank', () => {
    const el = makeScrollEl({ scrollHeight: 500, clientHeight: 400, scrollTop: 900 })
    scrollAiMessagesToBottom(el, true)
    expect(el.scrollTop).toBe(100)
  })

  it('scrollAiMessagesToBottom skips when not forced and user scrolled up', () => {
    const el = makeScrollEl({ scrollHeight: 2000, clientHeight: 400, scrollTop: 0 })
    scrollAiMessagesToBottom(el, false)
    expect(el.scrollTop).toBe(0)
  })

  it('scrollAiMessagesToBottom follows bottom when forced after stream end', () => {
    const el = makeScrollEl({ scrollHeight: 2000, clientHeight: 400, scrollTop: 1500 })
    scrollAiMessagesToBottom(el, true)
    expect(el.scrollTop).toBe(1600)
  })
})
