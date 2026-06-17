import { describe, expect, it } from 'vitest'
import { backwardKillWordDraft, feedCompletedUserLines } from '../feedCompletedUserLines'

describe('backwardKillWordDraft', () => {
  it('removes the last word', () => {
    expect(backwardKillWordDraft('npm run dev')).toBe('npm run ')
    expect(backwardKillWordDraft('hello')).toBe('')
  })

  it('skips trailing spaces before the word', () => {
    expect(backwardKillWordDraft('npm run  ')).toBe('npm ')
  })
})

describe('feedCompletedUserLines', () => {
  it('handles backward-kill-word in the draft', () => {
    const { draft } = feedCompletedUserLines('npm run dev', '\x17')
    expect(draft).toBe('npm run ')
  })
})
