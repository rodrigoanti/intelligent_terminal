import { describe, expect, it, vi } from 'vitest'
import {
  clearFollowDetached,
  FOLLOW_SLACK_LINES,
  isProgrammaticScroll,
  runWithProgrammaticScroll,
  shouldFollowTerminalOutput,
  type TerminalFollowState,
  followTerminalOutput,
  updateFollowDetachedState,
  writePtyDataWithFollowScroll,
} from '../terminalFollowScroll'

function makeMockTerm(opts: {
  viewportY: number
  baseY: number
  selection?: string
  isUserScrolling?: boolean
}) {
  const followCalls: number[] = []
  const writeCalls: string[] = []
  const state: TerminalFollowState = { userDetached: false }
  const term = {
    buffer: {
      active: {
        type: 'normal' as const,
        viewportY: opts.viewportY,
        baseY: opts.baseY,
      },
    },
    getSelection: () => opts.selection ?? '',
    scrollToBottom: () => { followCalls.push(1) },
    scrollLines: vi.fn(),
    write: (data: string, cb?: () => void) => {
      writeCalls.push(data)
      cb?.()
    },
    _core: {
      _bufferService: { isUserScrolling: opts.isUserScrolling ?? false },
    },
  }
  return { term: term as never, followCalls, writeCalls, state }
}

describe('terminalFollowScroll', () => {
  it('shouldFollowTerminalOutput returns false when user detached', () => {
    const { term } = makeMockTerm({ viewportY: 10, baseY: 10 })
    const state: TerminalFollowState = { userDetached: true }
    expect(shouldFollowTerminalOutput(term, state)).toBe(false)
  })

  it('shouldFollowTerminalOutput returns true near bottom within slack', () => {
    const { term } = makeMockTerm({
      viewportY: 7,
      baseY: 10,
    })
    const state: TerminalFollowState = { userDetached: false }
    expect(shouldFollowTerminalOutput(term, state, FOLLOW_SLACK_LINES)).toBe(true)
  })

  it('followTerminalOutput scrolls to bottom', () => {
    const { term, followCalls } = makeMockTerm({ viewportY: 8, baseY: 10 })
    followTerminalOutput(term)
    expect(followCalls.length).toBeGreaterThan(0)
  })

  it('writePtyDataWithFollowScroll writes data to terminal', () => {
    const { term, writeCalls, state } = makeMockTerm({ viewportY: 8, baseY: 10 })
    writePtyDataWithFollowScroll(term, 'hello', state)
    expect(writeCalls).toEqual(['hello'])
  })

  it('clearFollowDetached resets userDetached', () => {
    const state: TerminalFollowState = { userDetached: true }
    clearFollowDetached(state)
    expect(state.userDetached).toBe(false)
  })

  it('updateFollowDetachedState ignores programmatic scroll', () => {
    const { term } = makeMockTerm({ viewportY: 0, baseY: 10, isUserScrolling: true })
    const state: TerminalFollowState = { userDetached: false }
    runWithProgrammaticScroll(() => {
      updateFollowDetachedState(term, state)
    })
    expect(state.userDetached).toBe(false)
    expect(isProgrammaticScroll()).toBe(false)
  })
})
