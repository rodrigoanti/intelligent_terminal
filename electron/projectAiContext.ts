import { join, normalize, resolve } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { spawn } from 'child_process'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import { gatherShallowFolderTree } from './agentMd'

const MAX_DIR_ENTRIES = 320
const MAX_LISTING_CHARS = 12_000
const MAX_PACKAGE_JSON = 18_000
const MAX_GIT_STATUS_CHARS = 8_000
const MAX_GIT_DIFF_CHARS = 6_000
const GIT_TIMEOUT_MS = 6_000

/**
 * Ejecuta un comando git rápido y devuelve stdout o null si falla/timeout.
 * No bloquea el proceso principal.
 */
function runGitQuick(cwd: string, args: string[]): Promise<string | null> {
  return new Promise(resolvePromise => {
    let settled = false
    const done = (result: string | null): void => {
      if (settled) return
      settled = true
      resolvePromise(result)
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      done(null)
      return
    }

    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      done(null)
    }, GIT_TIMEOUT_MS)

    let out = ''
    child.stdout?.on('data', (buf: Buffer) => { out += buf.toString('utf-8') })
    child.on('error', () => { clearTimeout(timer); done(null) })
    child.on('close', (code) => {
      clearTimeout(timer)
      done(code === 0 && out.trim() ? out.trim() : null)
    })
  })
}

async function gatherGitContextForCwd(dir: string): Promise<{ status: string | null; diff: string | null }> {
  const repoRoot = await runGitQuick(dir, ['rev-parse', '--show-toplevel'])
  if (!repoRoot) return { status: null, diff: null }

  const [statusOut, diffOut] = await Promise.all([
    runGitQuick(repoRoot, ['status', '--short']),
    runGitQuick(repoRoot, ['diff', '--stat', 'HEAD']),
  ])

  const status = statusOut
    ? (statusOut.length > MAX_GIT_STATUS_CHARS
        ? `${statusOut.slice(0, MAX_GIT_STATUS_CHARS)}\n… (truncated)`
        : statusOut)
    : null

  const diff = diffOut
    ? (diffOut.length > MAX_GIT_DIFF_CHARS
        ? `${diffOut.slice(0, MAX_GIT_DIFF_CHARS)}\n… (truncated)`
        : diffOut)
    : null

  return { status, diff }
}

/**
 * Lista el directorio (equivalente informativo a `ls` en la raíz del cwd),
 * y opcionalmente package.json de esa misma carpeta.
 * El folderTree se obtiene por separado via getAgentFolderTree (IPC.AGENT_MD_TREE)
 * para no bloquear el proceso principal con lecturas recursivas en esta llamada.
 */
export async function gatherProjectAiContextForCwd(cwdRaw: string): Promise<ProjectAiContextForAi | null> {
  let dir: string
  try {
    dir = normalize(resolve(String(cwdRaw).trim()))
  } catch {
    return null
  }

  let st: ReturnType<typeof statSync>
  try {
    st = statSync(dir)
  } catch {
    return null
  }
  if (!st.isDirectory()) return null

  let dirents: import('fs').Dirent[]
  try {
    dirents = readdirSync(dir, { withFileTypes: true })
  } catch {
    return {
      cwd: dir,
      listing: '(could not read directory)',
      packageJson: null,
      folderTree: null,
      gitStatus: null,
      gitDiff: null,
    }
  }

  dirents.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )

  const lines: string[] = []
  for (const e of dirents) {
    if (lines.length >= MAX_DIR_ENTRIES) {
      lines.push('… (more entries omitted)')
      break
    }
    const suffix = e.isDirectory() ? '/' : ''
    lines.push(`${e.name}${suffix}`)
  }

  let listing = lines.join('\n')
  if (listing.length > MAX_LISTING_CHARS) {
    listing = `${listing.slice(0, MAX_LISTING_CHARS)}\n… (listing truncated)`
  }

  let packageJson: string | null = null
  const pkgPath = join(dir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, 'utf-8')
      packageJson =
        raw.length > MAX_PACKAGE_JSON
          ? `${raw.slice(0, MAX_PACKAGE_JSON)}\n… (package.json truncated)`
          : raw
    } catch {
      packageJson = null
    }
  }

  const { status: gitStatus, diff: gitDiff } = await gatherGitContextForCwd(dir)
  const folderTree = gatherShallowFolderTree(dir)

  return { cwd: dir, listing, packageJson, folderTree, gitStatus, gitDiff }
}
