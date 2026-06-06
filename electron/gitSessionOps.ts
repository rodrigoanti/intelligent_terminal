import { spawn } from 'child_process'
import { normalize, resolve } from 'path'
import { statSync } from 'fs'
import type {
  GitCommandResult,
  GitDiffForAiPayload,
  GitPathEntry,
  GitRepoStatus,
} from '../src/shared/gitSessionTypes'
import {
  GIT_MAX_COMMIT_MESSAGE_CHARS,
  GIT_MAX_OUTPUT_BYTES,
} from '../src/shared/gitSessionTypes'
import { GIT_ERROR_CODES } from '../src/shared/gitErrorCodes'

const TIMEOUT_LOCAL_MS = 120_000
const TIMEOUT_NETWORK_MS = 900_000

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

function capOutput(s: string, max = GIT_MAX_OUTPUT_BYTES): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n[…salida truncada…]`
}

function runGit(
  cwd: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<GitCommandResult> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: GitCommandResult): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn('git', args as string[], {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {
            /* ignore */
          }
        }, 1500)
      } catch {
        /* ignore */
      }
      if (!settled) {
        finish({
          ok: false,
          exitCode: null,
          stdout: '',
          stderr: `timeout (${Math.round(timeoutMs / 1000)}s)`,
          errorCode: GIT_ERROR_CODES.TIMEOUT,
        })
      }
    }, timeoutMs)

    let out = ''
    let err = ''

    const cap = (prev: string, chunk: string): string => {
      const space = GIT_MAX_OUTPUT_BYTES - prev.length
      if (chunk.length <= space) return prev + chunk
      return prev + chunk.slice(0, Math.max(0, space)) + '\n[…truncado…]'
    }

    child.stdout?.on('data', (buf: Buffer) => {
      out = cap(out, buf.toString('utf-8'))
    })
    child.stderr?.on('data', (buf: Buffer) => {
      err = cap(err, buf.toString('utf-8'))
    })

    child.on('error', (e: Error) => {
      clearTimeout(timer)
      finish({ ok: false, exitCode: null, stdout: out, stderr: e.message || String(e) })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (settled) return
      const sigNote = signal ? `\n(signal: ${signal})` : ''
      finish({
        ok: code === 0,
        exitCode: code,
        stdout: out + sigNote,
        stderr: err,
      })
    })
  })
}

async function getRepoRoot(sessionCwd: string): Promise<string | null> {
  const r = await runGit(sessionCwd, ['rev-parse', '--show-toplevel'], TIMEOUT_LOCAL_MS)
  if (r.exitCode !== 0) return null
  const root = r.stdout.trim().split('\n')[0]?.trim()
  return root || null
}

/** Parsea la primera línea de `git status -sb` (## …). */
function parseBranchLine(line: string): Pick<GitRepoStatus, 'branch' | 'upstream' | 'ahead' | 'behind'> {
  if (!line.startsWith('## ')) {
    return { branch: line.replace(/^##\s*/, '').trim() || 'unknown' }
  }
  const rest = line.slice(3).trim()
  const bracketIdx = rest.indexOf(' [')
  const core = bracketIdx >= 0 ? rest.slice(0, bracketIdx) : rest
  let ahead: number | undefined
  let behind: number | undefined
  if (bracketIdx >= 0) {
    const inside = rest.slice(bracketIdx + 2, rest.lastIndexOf(']'))
    const aheadM = /ahead (\d+)/.exec(inside)
    const behindM = /behind (\d+)/.exec(inside)
    if (aheadM) ahead = Number(aheadM[1])
    if (behindM) behind = Number(behindM[1])
  }
  const dots = '...'
  const dotIdx = core.indexOf(dots)
  if (dotIdx >= 0) {
    return {
      branch: core.slice(0, dotIdx).trim() || 'HEAD',
      upstream: core.slice(dotIdx + dots.length).trim() || undefined,
      ahead,
      behind,
    }
  }
  return { branch: core.trim() || 'HEAD', ahead, behind }
}

function parsePorcelain(lines: string[]): GitPathEntry[] {
  const out: GitPathEntry[] = []
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    if (line.length < 4) continue
    const xy = line.slice(0, 2)
    const pathPart = line.slice(3)
    out.push({ status: xy, path: pathPart })
  }
  return out
}

function porcelainHasStaged(files: GitPathEntry[]): boolean {
  return files.some(f => f.status[0] !== ' ' && f.status[0] !== '?')
}

function porcelainHasUnstaged(files: GitPathEntry[]): boolean {
  return files.some(f => f.status[1] !== ' ')
}

export async function gitGetRepoStatus(sessionCwdRaw: string): Promise<GitRepoStatus> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      isRepo: false,
      sessionCwd: sessionCwdRaw.trim(),
      files: [],
      hasStaged: false,
      hasUnstaged: false,
      error: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      isRepo: false,
      sessionCwd,
      files: [],
      hasStaged: false,
      hasUnstaged: false,
      error: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }

  const [sb, por, stat, stagedStat, numStat, stagedNumStat] = await Promise.all([
    runGit(repoRoot, ['status', '-sb'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['status', '--porcelain=v1'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--stat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--cached', '--stat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--numstat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--cached', '--numstat'], TIMEOUT_LOCAL_MS),
  ])

  const sbLines = sb.stdout.split('\n').filter(Boolean)
  const branchLine = sbLines[0] ?? ''
  const branchInfo = parseBranchLine(branchLine)
  const files = parsePorcelain(por.stdout.split('\n').filter(Boolean))

  return {
    isRepo: true,
    sessionCwd,
    repoRoot,
    branchLine,
    ...branchInfo,
    files,
    diffStat: capOutput(stat.stdout, 80_000),
    stagedDiffStat: capOutput(stagedStat.stdout, 40_000),
    diffNumStat: capOutput(numStat.stdout, 80_000),
    stagedDiffNumStat: capOutput(stagedNumStat.stdout, 40_000),
    hasStaged: porcelainHasStaged(files),
    hasUnstaged: porcelainHasUnstaged(files),
  }
}

export async function gitDiffForAi(sessionCwdRaw: string): Promise<GitDiffForAiPayload> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return { ok: false, text: '', error: 'cwd inválido' }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return { ok: false, text: '', error: 'no es un repositorio git' }
  }

  const sb = await runGit(repoRoot, ['status', '-sb'], TIMEOUT_LOCAL_MS)
  const staged = await runGit(repoRoot, ['diff', '--cached'], TIMEOUT_LOCAL_MS)
  let budget = GIT_MAX_OUTPUT_BYTES - sb.stdout.length - 200
  let body = `${sb.stdout.trim()}\n\n--- staged (git diff --cached) ---\n${staged.stdout}`
  if (body.length > GIT_MAX_OUTPUT_BYTES - 5000) {
    body = capOutput(body, GIT_MAX_OUTPUT_BYTES - 5000)
    budget = Math.max(0, GIT_MAX_OUTPUT_BYTES - body.length - 100)
  }
  if (budget > 2000) {
    const unstaged = await runGit(repoRoot, ['diff'], TIMEOUT_LOCAL_MS)
    body += `\n\n--- unstaged (git diff) ---\n${capOutput(unstaged.stdout, budget)}`
  }
  return { ok: true, text: capOutput(body, GIT_MAX_OUTPUT_BYTES) }
}

export function validateCommitMessage(msg: unknown): string | null {
  if (typeof msg !== 'string') return 'mensaje inválido'
  const t = msg.replace(/\r\n/g, '\n').trim()
  if (!t) return 'mensaje vacío'
  if (t.includes('\0')) return 'caracteres no permitidos'
  if (t.length > GIT_MAX_COMMIT_MESSAGE_CHARS) {
    return `mensaje demasiado largo (máx. ${GIT_MAX_COMMIT_MESSAGE_CHARS})`
  }
  return null
}

export async function gitPull(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  return runGit(repoRoot, ['pull', '--ff-only'], TIMEOUT_NETWORK_MS)
}

export async function gitPush(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  return runGit(repoRoot, ['push'], TIMEOUT_NETWORK_MS)
}

export async function gitCommit(sessionCwdRaw: string, message: unknown): Promise<GitCommandResult> {
  const err = validateCommitMessage(message)
  if (err) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: err,
      errorCode: GIT_ERROR_CODES.INVALID_COMMIT_MESSAGE,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  const msg = String(message).replace(/\r\n/g, '\n').trim()
  return runGit(repoRoot, ['commit', '-m', msg], TIMEOUT_LOCAL_MS)
}

export async function gitStageAll(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['add', '-A'], TIMEOUT_LOCAL_MS)
}

export async function gitStageFile(sessionCwdRaw: string, relPathRaw: unknown): Promise<GitCommandResult> {
  const relPath = String(relPathRaw ?? '').trim().replace(/\\/g, '/')
  if (!relPath || relPath.includes('\0') || relPath.startsWith('/')) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'ruta inválida',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['add', '--', relPath], TIMEOUT_LOCAL_MS)
}

export async function gitUnstageAll(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['restore', '--staged', '.'], TIMEOUT_LOCAL_MS)
}

export async function gitUnstageFile(sessionCwdRaw: string, relPathRaw: unknown): Promise<GitCommandResult> {
  const relPath = String(relPathRaw ?? '').trim().replace(/\\/g, '/')
  if (!relPath || relPath.includes('\0') || relPath.startsWith('/')) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'ruta inválida',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['restore', '--staged', '--', relPath], TIMEOUT_LOCAL_MS)
}
