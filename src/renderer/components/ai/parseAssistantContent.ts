import {
  GIT_BLOCK_END,
  GIT_BLOCK_START,
  GLOB_BLOCK_END,
  GLOB_BLOCK_START,
  GREP_BLOCK_END,
  GREP_BLOCK_START,
  LIST_BLOCK_END,
  LIST_BLOCK_START,
  PATCH_BLOCK_END,
  parseReadLine,
  READ_BLOCK_END,
  READ_BLOCK_START,
  RUN_BLOCK_END,
  RUN_BLOCK_START,
} from '@shared/agentFileProtocol'

export type AssistantSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }
  | { type: 'read'; requests: Array<{ path: string; startLine?: number; endLine?: number }>; pending: boolean }
  | { type: 'grep'; queries: Array<{ pattern: string; scope: string }>; pending: boolean }
  | { type: 'list'; dirs: string[]; pending: boolean }
  | { type: 'glob'; patterns: string[]; pending: boolean }
  | { type: 'git'; command: string; paths: string[]; pending: boolean }
  | { type: 'patch'; path: string; hunkCount: number; pending: boolean }
  | { type: 'write'; path: string; content: string; pending: boolean }
  | { type: 'run'; commands: string[]; pending: boolean }
  | { type: 'files-written'; paths: string[] }
  | { type: 'patches-applied'; paths: string[] }
  | { type: 'writes-blocked'; items: Array<{ path: string; reason: string }> }
  | { type: 'patches-blocked'; items: Array<{ path: string; reason: string }> }
  | { type: 'write-errors'; items: Array<{ path: string; message: string }> }
  | { type: 'patch-errors'; items: Array<{ path: string; message: string }> }
  | { type: 'agent-limit'; message: string }

const WRITE_START = '<<<AI_TERMINAL_WRITE path="'
const WRITE_END = '<<<END_AI_TERMINAL_WRITE>>>'
const PATCH_START = '<<<AI_TERMINAL_PATCH path="'

function parsePathLines(inner: string): string[] {
  const seen = new Set<string>()
  const paths: string[] = []
  for (const line of inner.split('\n')) {
    const p = line.trim().replace(/^[`'"]+|[`'"]+$/g, '')
    if (!p || p.startsWith('#') || seen.has(p)) continue
    seen.add(p)
    paths.push(p)
  }
  return paths
}

function parseRunCommands(inner: string): string[] {
  const commands: string[] = []
  for (const line of inner.split('\n')) {
    const c = line.trim()
    if (!c || c.startsWith('#')) continue
    commands.push(c)
  }
  return commands
}

function parseBacktickPaths(line: string): string[] {
  const paths: string[] = []
  const re = /`([^`]+)`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    paths.push(m[1])
  }
  return paths
}

function parseBlockedItems(line: string): Array<{ path: string; reason: string }> {
  const items: Array<{ path: string; reason: string }> = []
  const re = /`([^`]+)`\s*\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    items.push({ path: m[1], reason: m[2] })
  }
  return items
}

function parseWriteErrors(line: string): Array<{ path: string; message: string }> {
  const inner = line.replace(/^_✗ Write errors:\s*/i, '').replace(/_$/g, '').trim()
  if (!inner) return []
  return inner.split(';').map(part => {
    const idx = part.indexOf(':')
    if (idx === -1) return { path: part.trim(), message: '' }
    return { path: part.slice(0, idx).trim(), message: part.slice(idx + 1).trim() }
  }).filter(x => x.path)
}

function parseFooter(footer: string, out: AssistantSegment[]): void {
  for (const line of footer.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (/^_✓ Files written:/i.test(t)) {
      out.push({ type: 'files-written', paths: parseBacktickPaths(t) })
    } else if (/^_✓ Patches applied:/i.test(t)) {
      out.push({ type: 'patches-applied', paths: parseBacktickPaths(t) })
    } else if (/^_⊘ Writes blocked/i.test(t)) {
      out.push({ type: 'writes-blocked', items: parseBlockedItems(t) })
    } else if (/^_⊘ Patches blocked/i.test(t)) {
      out.push({ type: 'patches-blocked', items: parseBlockedItems(t) })
    } else if (/^_✗ Write errors:/i.test(t)) {
      out.push({ type: 'write-errors', items: parseWriteErrors(t) })
    } else if (/^_✗ Patch errors:/i.test(t)) {
      out.push({ type: 'patch-errors', items: parseWriteErrors(t) })
    } else if (/^_Agent round limit/i.test(t)) {
      out.push({ type: 'agent-limit', message: t.replace(/^_+|_+$/g, '') })
    }
  }
}

function splitFooter(raw: string): { body: string; footer: string | null } {
  const idx = raw.lastIndexOf('\n\n---\n')
  if (idx === -1) return { body: raw, footer: null }
  const footer = raw.slice(idx + 5)
  if (!/_✓ Files written:|_✓ Patches applied:|_⊘ Writes blocked|_⊘ Patches blocked|_✗ Write errors:|_✗ Patch errors:|_Agent round limit/i.test(footer)) {
    return { body: raw, footer: null }
  }
  return { body: raw.slice(0, idx).trimEnd(), footer }
}

function parseBody(text: string): AssistantSegment[] {
  const segments: AssistantSegment[] = []
  let i = 0

  const pushText = (chunk: string): void => {
    const t = chunk.trimEnd()
    if (t) segments.push({ type: 'text', content: t })
  }

  const parseReadInner = (inner: string) => {
    const requests: Array<{ path: string; startLine?: number; endLine?: number }> = []
    for (const line of inner.split('\n')) {
      const req = parseReadLine(line)
      if (req) requests.push(req)
    }
    return requests
  }

  while (i < text.length) {
    const readIdx = text.indexOf(READ_BLOCK_START, i)
    const grepIdx = text.indexOf(GREP_BLOCK_START, i)
    const listIdx = text.indexOf(LIST_BLOCK_START, i)
    const globIdx = text.indexOf(GLOB_BLOCK_START, i)
    const gitIdx = text.indexOf(GIT_BLOCK_START, i)
    const patchIdx = text.indexOf(PATCH_START, i)
    const writeIdx = text.indexOf(WRITE_START, i)
    const runIdx = text.indexOf(RUN_BLOCK_START, i)
    const codeIdx = text.indexOf('```', i)

    const next = Math.min(
      readIdx >= 0 ? readIdx : Infinity,
      grepIdx >= 0 ? grepIdx : Infinity,
      listIdx >= 0 ? listIdx : Infinity,
      globIdx >= 0 ? globIdx : Infinity,
      gitIdx >= 0 ? gitIdx : Infinity,
      patchIdx >= 0 ? patchIdx : Infinity,
      writeIdx >= 0 ? writeIdx : Infinity,
      runIdx >= 0 ? runIdx : Infinity,
      codeIdx >= 0 ? codeIdx : Infinity,
    )

    if (next === Infinity) {
      pushText(text.slice(i))
      break
    }

    if (next > i) pushText(text.slice(i, next))
    i = next

    if (text.startsWith(GREP_BLOCK_START, i)) {
      const afterStart = i + GREP_BLOCK_START.length
      const end = text.indexOf(GREP_BLOCK_END, afterStart)
      const parseInner = (inner: string) => {
        const queries: Array<{ pattern: string; scope: string }> = []
        for (const line of inner.split('\n')) {
          const raw = line.trim()
          if (!raw || raw.startsWith('#')) continue
          const sep = raw.indexOf('::')
          if (sep === -1) {
            queries.push({ pattern: raw, scope: '.' })
          } else {
            queries.push({
              pattern: raw.slice(0, sep).trim(),
              scope: raw.slice(sep + 2).trim() || '.',
            })
          }
        }
        return queries
      }
      if (end === -1) {
        segments.push({ type: 'grep', queries: parseInner(text.slice(afterStart)), pending: true })
        break
      }
      segments.push({
        type: 'grep',
        queries: parseInner(text.slice(afterStart, end)),
        pending: false,
      })
      i = end + GREP_BLOCK_END.length
      continue
    }

    if (text.startsWith(LIST_BLOCK_START, i)) {
      const afterStart = i + LIST_BLOCK_START.length
      const end = text.indexOf(LIST_BLOCK_END, afterStart)
      const dirs = parsePathLines(end === -1 ? text.slice(afterStart) : text.slice(afterStart, end))
      segments.push({ type: 'list', dirs, pending: end === -1 })
      if (end === -1) break
      i = end + LIST_BLOCK_END.length
      continue
    }

    if (text.startsWith(GLOB_BLOCK_START, i)) {
      const afterStart = i + GLOB_BLOCK_START.length
      const end = text.indexOf(GLOB_BLOCK_END, afterStart)
      const patterns = parsePathLines(end === -1 ? text.slice(afterStart) : text.slice(afterStart, end))
      segments.push({ type: 'glob', patterns, pending: end === -1 })
      if (end === -1) break
      i = end + GLOB_BLOCK_END.length
      continue
    }

    if (text.startsWith(GIT_BLOCK_START, i)) {
      const afterStart = i + GIT_BLOCK_START.length
      const end = text.indexOf(GIT_BLOCK_END, afterStart)
      const lines = parsePathLines(end === -1 ? text.slice(afterStart) : text.slice(afterStart, end))
      segments.push({
        type: 'git',
        command: lines[0] ?? 'status',
        paths: lines.slice(1),
        pending: end === -1,
      })
      if (end === -1) break
      i = end + GIT_BLOCK_END.length
      continue
    }

    if (text.startsWith(READ_BLOCK_START, i)) {
      const afterStart = i + READ_BLOCK_START.length
      const end = text.indexOf(READ_BLOCK_END, afterStart)
      if (end === -1) {
        segments.push({ type: 'read', requests: parseReadInner(text.slice(afterStart)), pending: true })
        break
      }
      segments.push({
        type: 'read',
        requests: parseReadInner(text.slice(afterStart, end)),
        pending: false,
      })
      i = end + READ_BLOCK_END.length
      continue
    }

    if (text.startsWith(PATCH_START, i)) {
      const pathStart = i + PATCH_START.length
      const pathEnd = text.indexOf('">>>', pathStart)
      if (pathEnd === -1) break
      const path = text.slice(pathStart, pathEnd)
      const contentStart = pathEnd + 4
      const end = text.indexOf(PATCH_BLOCK_END, contentStart)
      const inner = end === -1 ? text.slice(contentStart) : text.slice(contentStart, end)
      const hunkCount = (inner.match(/<<<< SEARCH/g) ?? []).length
      segments.push({ type: 'patch', path, hunkCount, pending: end === -1 })
      if (end === -1) break
      i = end + PATCH_BLOCK_END.length
      continue
    }

    if (text.startsWith(WRITE_START, i)) {
      const pathStart = i + WRITE_START.length
      const pathEnd = text.indexOf('">>>', pathStart)
      if (pathEnd === -1) break
      const path = text.slice(pathStart, pathEnd)
      const contentStart = pathEnd + 4
      const end = text.indexOf(WRITE_END, contentStart)
      if (end === -1) {
        segments.push({
          type: 'write',
          path,
          content: text.slice(contentStart),
          pending: true,
        })
        break
      }
      segments.push({
        type: 'write',
        path,
        content: text.slice(contentStart, end).replace(/\n$/, ''),
        pending: false,
      })
      i = end + WRITE_END.length
      continue
    }

    if (text.startsWith(RUN_BLOCK_START, i)) {
      const afterStart = i + RUN_BLOCK_START.length
      const end = text.indexOf(RUN_BLOCK_END, afterStart)
      if (end === -1) {
        segments.push({ type: 'run', commands: parseRunCommands(text.slice(afterStart)), pending: true })
        break
      }
      segments.push({
        type: 'run',
        commands: parseRunCommands(text.slice(afterStart, end)),
        pending: false,
      })
      i = end + RUN_BLOCK_END.length
      continue
    }

    if (text.startsWith('```', i)) {
      const langEnd = text.indexOf('\n', i + 3)
      if (langEnd === -1) break
      const lang = text.slice(i + 3, langEnd).trim()
      const contentStart = langEnd + 1
      const close = text.indexOf('\n```', contentStart)
      if (close === -1) {
        segments.push({ type: 'code', lang, content: text.slice(contentStart) })
        break
      }
      segments.push({ type: 'code', lang, content: text.slice(contentStart, close).trimEnd() })
      i = close + 4
      continue
    }

    break
  }

  return segments
}

/** Convierte el texto crudo del asistente en segmentos renderizables (acciones + texto + código). */
export function parseAssistantContent(raw: string): AssistantSegment[] {
  const { body, footer } = splitFooter(raw)
  const footerSegments: AssistantSegment[] = []
  if (footer) parseFooter(footer, footerSegments)
  return [...parseBody(body), ...footerSegments]
}
