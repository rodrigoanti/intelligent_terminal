import { describe, expect, it } from 'vitest'
import {
  extractGrepBlock,
  extractReadBlock,
  extractRunBlocks,
  GREP_BLOCK_END,
  GREP_BLOCK_START,
  READ_BLOCK_END,
  READ_BLOCK_START,
} from '../agentFileProtocol'

describe('agentFileProtocol multi-block', () => {
  it('extracts multiple RUN blocks', () => {
    const text = `<<<AI_TERMINAL_RUN>>>\nls\n<<<END_AI_TERMINAL_RUN>>>\n<<<AI_TERMINAL_RUN>>>\npwd\n<<<END_AI_TERMINAL_RUN>>>`
    const { commands } = extractRunBlocks(text)
    expect(commands).toEqual(['ls', 'pwd'])
  })

  it('extracts multiple READ blocks', () => {
    const text =
      `${READ_BLOCK_START}\nsrc/a.ts\n${READ_BLOCK_END}\n` +
      `${READ_BLOCK_START}\nsrc/b.ts\n${READ_BLOCK_END}`
    const { requests } = extractReadBlock(text)
    expect(requests.map(r => r.path)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('extracts multiple GREP blocks', () => {
    const text =
      `${GREP_BLOCK_START}\nfoo\n${GREP_BLOCK_END}\n` +
      `${GREP_BLOCK_START}\nbar :: src\n${GREP_BLOCK_END}`
    const { queries } = extractGrepBlock(text)
    expect(queries).toHaveLength(2)
  })
})
