import { describe, expect, it } from 'vitest'
import { mapRestWorkflowRun } from '../../../electron/githubApi'

describe('mapRestWorkflowRun', () => {
  it('maps GitHub REST workflow run fields', () => {
    const mapped = mapRestWorkflowRun({
      id: 42,
      name: 'CI',
      display_title: 'Fix build',
      status: 'completed',
      conclusion: 'success',
      head_branch: 'main',
      event: 'push',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:05:00Z',
      html_url: 'https://github.com/o/r/actions/runs/42',
    })

    expect(mapped).toEqual({
      id: 42,
      title: 'Fix build',
      status: 'completed',
      conclusion: 'success',
      headBranch: 'main',
      event: 'push',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:05:00Z',
      url: 'https://github.com/o/r/actions/runs/42',
    })
  })

  it('returns null when id is missing', () => {
    expect(mapRestWorkflowRun({} as { id: number })).toBeNull()
  })
})
