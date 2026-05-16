export type GitHubActionsErrorCode =
  | 'not_repo'
  | 'not_github'
  | 'gh_missing'
  | 'gh_not_authed'
  | 'gh_failed'
  | 'invalid_cwd'

export interface GitHubRepoRef {
  owner: string
  repo: string
  fullName: string
}

export interface GitHubActionsRun {
  id: number
  title: string
  status: string
  conclusion: string | null
  headBranch: string
  event: string
  createdAt: string
  updatedAt: string
  url: string
}

export interface GitHubActionsSnapshot {
  ok: boolean
  repo: GitHubRepoRef | null
  runs: GitHubActionsRun[]
  error?: string
  errorCode?: GitHubActionsErrorCode
}
