import { spawn } from 'child_process'
import { normalize, resolve } from 'path'
import { statSync } from 'fs'
import type {
  GitHubActionsErrorCode,
  GitHubActionsRun,
  GitHubActionsSnapshot,
  GitHubRepoRef,
} from '../src/shared/githubActionsTypes'

const TIMEOUT_MS = 120_000
const RUN_LIST_LIMIT = 15

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

/** Parsea owner/repo desde URLs habituales de GitHub. */
export function parseGitHubRemoteUrl(raw: string): GitHubRepoRef | null {
  const s = raw.trim()
  if (!s) return null

  const ssh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(s)
  if (ssh) {
    const owner = ssh[1]
    const repo = ssh[2].replace(/\.git$/i, '')
    return { owner, repo, fullName: `${owner}/${repo}` }
  }

  try {
    const u = new URL(s)
    if (u.hostname.toLowerCase() !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/i, '')
    return { owner, repo, fullName: `${owner}/${repo}` }
  } catch {
    return null
  }
}

function spawnCapture(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number },
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: { exitCode: number | null; stdout: string; stderr: string }): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env:
        cmd === 'git'
          ? ({ ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv)
          : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      finish({ exitCode: null, stdout: '', stderr: `timeout (${Math.round(options.timeoutMs / 1000)}s)` })
    }, options.timeoutMs)

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', err => {
      clearTimeout(timer)
      finish({ exitCode: null, stdout: '', stderr: err.message })
    })

    child.on('close', code => {
      clearTimeout(timer)
      finish({ exitCode: code, stdout, stderr })
    })
  })
}

async function getRepoRoot(sessionCwd: string): Promise<string | null> {
  const r = await spawnCapture('git', ['rev-parse', '--show-toplevel'], { cwd: sessionCwd, timeoutMs: TIMEOUT_MS })
  if (r.exitCode !== 0) return null
  const root = r.stdout.trim().split('\n')[0]?.trim()
  return root || null
}

async function resolveGitHubRepo(repoRoot: string): Promise<GitHubRepoRef | null> {
  const r = await spawnCapture('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, timeoutMs: TIMEOUT_MS })
  if (r.exitCode !== 0) return null
  const url = r.stdout.trim().split('\n')[0]?.trim() ?? ''
  return parseGitHubRemoteUrl(url)
}

function fail(
  errorCode: GitHubActionsErrorCode,
  error: string,
  repo: GitHubRepoRef | null = null,
): GitHubActionsSnapshot {
  return { ok: false, repo, runs: [], error, errorCode }
}

function mapGhRun(raw: Record<string, unknown>): GitHubActionsRun | null {
  const id = typeof raw.databaseId === 'number' ? raw.databaseId : Number(raw.databaseId)
  if (!Number.isFinite(id)) return null
  return {
    id,
    title: String(raw.displayTitle ?? raw.title ?? 'Workflow run'),
    status: String(raw.status ?? 'unknown'),
    conclusion: raw.conclusion != null ? String(raw.conclusion) : null,
    headBranch: String(raw.headBranch ?? ''),
    event: String(raw.event ?? ''),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    url: String(raw.url ?? ''),
  }
}

export async function githubActionsListForSession(
  sessionCwdRaw: string,
): Promise<GitHubActionsSnapshot> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return fail('invalid_cwd', 'cwd inválido')
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return fail('not_repo', 'no es un repositorio git')
  }

  const repo = await resolveGitHubRepo(repoRoot)
  if (!repo) {
    return fail('not_github', 'El remote origin no apunta a un repositorio de GitHub.')
  }

  const versionCheck = await spawnCapture('gh', ['--version'], { timeoutMs: 8_000 })
  if (versionCheck.exitCode !== 0) {
    return fail(
      'gh_missing',
      'GitHub CLI (gh) no está instalado o no está en el PATH.',
      repo,
    )
  }

  const authCheck = await spawnCapture('gh', ['auth', 'status'], { timeoutMs: 15_000 })
  if (authCheck.exitCode !== 0) {
    const hint = authCheck.stderr.trim() || authCheck.stdout.trim()
    return fail(
      'gh_not_authed',
      hint
        ? `gh no está autenticado: ${hint}`
        : 'Ejecuta «gh auth login» para ver los workflow runs.',
      repo,
    )
  }

  const list = await spawnCapture(
    'gh',
    [
      'run',
      'list',
      '--repo',
      repo.fullName,
      '--limit',
      String(RUN_LIST_LIMIT),
      '--json',
      'databaseId,displayTitle,status,conclusion,headBranch,event,createdAt,updatedAt,url',
    ],
    { timeoutMs: TIMEOUT_MS },
  )

  if (list.exitCode !== 0) {
    const msg = list.stderr.trim() || list.stdout.trim() || 'Error al listar runs'
    return fail('gh_failed', msg, repo)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(list.stdout.trim() || '[]')
  } catch {
    return fail('gh_failed', 'Respuesta JSON inválida de gh run list', repo)
  }

  if (!Array.isArray(parsed)) {
    return fail('gh_failed', 'Respuesta inesperada de gh run list', repo)
  }

  const runs: GitHubActionsRun[] = []
  for (const item of parsed) {
    if (item && typeof item === 'object') {
      const mapped = mapGhRun(item as Record<string, unknown>)
      if (mapped) runs.push(mapped)
    }
  }

  return { ok: true, repo, runs }
}
