/** Marcadores para modo agente (lectura/escritura bajo el cwd de la sesión). */

export const READ_BLOCK_START = '<<<AI_TERMINAL_READ>>>'
export const READ_BLOCK_END = '<<<END_AI_TERMINAL_READ>>>'
export const RUN_BLOCK_START = '<<<AI_TERMINAL_RUN>>>'
export const RUN_BLOCK_END = '<<<END_AI_TERMINAL_RUN>>>'
export const GREP_BLOCK_START = '<<<AI_TERMINAL_GREP>>>'
export const GREP_BLOCK_END = '<<<END_AI_TERMINAL_GREP>>>'
export const LIST_BLOCK_START = '<<<AI_TERMINAL_LIST>>>'
export const LIST_BLOCK_END = '<<<END_AI_TERMINAL_LIST>>>'
export const GLOB_BLOCK_START = '<<<AI_TERMINAL_GLOB>>>'
export const GLOB_BLOCK_END = '<<<END_AI_TERMINAL_GLOB>>>'
export const GIT_BLOCK_START = '<<<AI_TERMINAL_GIT>>>'
export const GIT_BLOCK_END = '<<<END_AI_TERMINAL_GIT>>>'
export const PATCH_BLOCK_START = '<<<AI_TERMINAL_PATCH path="'
export const PATCH_BLOCK_END = '<<<END_AI_TERMINAL_PATCH>>>'
export const WRITE_BLOCK_START = '<<<AI_TERMINAL_WRITE path="'
export const WRITE_BLOCK_MID = '">>>'
export const WRITE_BLOCK_END = '<<<END_AI_TERMINAL_WRITE>>>'

export interface ReadRequest {
  path: string
  startLine?: number
  endLine?: number
}

export interface ReadBlockResult {
  stripped: string
  requests: ReadRequest[]
}

/**
 * Extrae un bloque READ del final del mensaje del asistente (si existe).
 */
/**
 * Quita todos los bloques RUN y devuelve los comandos (una línea = un comando), en orden.
 */
export function extractRunBlocks(text: string): { stripped: string; commands: string[] } {
  const commands: string[] = []
  let stripped = text
  const startMark = RUN_BLOCK_START
  const endMark = RUN_BLOCK_END
  for (;;) {
    const start = stripped.indexOf(startMark)
    if (start === -1) break
    const afterStart = start + startMark.length
    const end = stripped.indexOf(endMark, afterStart)
    if (end === -1) break
    const inner = stripped.slice(afterStart, end)
    for (const line of inner.split('\n')) {
      const c = line.trim()
      if (!c || c.startsWith('#')) continue
      commands.push(c)
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + endMark.length)
  }
  return { stripped: stripped.trimEnd(), commands }
}

export interface GrepQuery {
  pattern: string
  /** Ruta relativa o `.` para todo el proyecto. */
  scope: string
}

export interface GrepBlockResult {
  stripped: string
  queries: GrepQuery[]
}

/** Parsea `patrón` o `patrón :: src/carpeta` por línea. */
function parseGrepLine(line: string): GrepQuery | null {
  const raw = line.trim()
  if (!raw || raw.startsWith('#')) return null
  const sep = raw.indexOf('::')
  if (sep === -1) return { pattern: raw.replace(/^[`'"]+|[`'"]+$/g, ''), scope: '.' }
  const pattern = raw.slice(0, sep).trim().replace(/^[`'"]+|[`'"]+$/g, '')
  const scope = raw.slice(sep + 2).trim().replace(/^[`'"]+|[`'"]+$/g, '') || '.'
  if (!pattern) return null
  return { pattern, scope }
}

export function extractGrepBlock(text: string): GrepBlockResult {
  const queries: GrepQuery[] = []
  const seen = new Set<string>()
  let stripped = text
  for (;;) {
    const start = stripped.indexOf(GREP_BLOCK_START)
    if (start === -1) break
    const afterStart = start + GREP_BLOCK_START.length
    const end = stripped.indexOf(GREP_BLOCK_END, afterStart)
    if (end === -1) break
    const inner = stripped.slice(afterStart, end)
    for (const line of inner.split('\n')) {
      const q = parseGrepLine(line)
      if (!q) continue
      const key = `${q.pattern}\0${q.scope}`
      if (seen.has(key)) continue
      seen.add(key)
      queries.push(q)
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + GREP_BLOCK_END.length)
  }
  return { stripped: stripped.trimEnd(), queries }
}

/** `path`, `path:42` (una línea) o `path:10-80` (rango 1-indexed). */
export function parseReadLine(line: string): ReadRequest | null {
  const raw = line.trim().replace(/^[`'"]+|[`'"]+$/g, '')
  if (!raw || raw.startsWith('#')) return null
  const rangeMatch = raw.match(/^(.+):(\d+)(?:-(\d+))?$/)
  if (rangeMatch) {
    const path = rangeMatch[1].trim()
    const startLine = parseInt(rangeMatch[2], 10)
    const endLine = parseInt(rangeMatch[3] ?? rangeMatch[2], 10)
    if (!path || Number.isNaN(startLine) || Number.isNaN(endLine)) return null
    return { path, startLine, endLine: Math.max(startLine, endLine) }
  }
  return { path: raw }
}

export function extractReadBlock(text: string): ReadBlockResult {
  const requests: ReadRequest[] = []
  const seen = new Set<string>()
  let stripped = text
  for (;;) {
    const start = stripped.indexOf(READ_BLOCK_START)
    if (start === -1) break
    const afterStart = start + READ_BLOCK_START.length
    const end = stripped.indexOf(READ_BLOCK_END, afterStart)
    if (end === -1) break
    const inner = stripped.slice(afterStart, end)
    for (const line of inner.split('\n')) {
      const req = parseReadLine(line)
      if (!req) continue
      const key = `${req.path}:${req.startLine ?? ''}:${req.endLine ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      requests.push(req)
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + READ_BLOCK_END.length)
  }
  return { stripped: stripped.trimEnd(), requests }
}

function parseBlockLines(inner: string): string[] {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const line of inner.split('\n')) {
    const p = line.trim().replace(/^[`'"]+|[`'"]+$/g, '')
    if (!p || p.startsWith('#') || seen.has(p)) continue
    seen.add(p)
    lines.push(p)
  }
  return lines
}

export function extractListBlock(text: string): { stripped: string; dirs: string[] } {
  const dirs: string[] = []
  const seen = new Set<string>()
  let stripped = text
  for (;;) {
    const start = stripped.indexOf(LIST_BLOCK_START)
    if (start === -1) break
    const afterStart = start + LIST_BLOCK_START.length
    const end = stripped.indexOf(LIST_BLOCK_END, afterStart)
    if (end === -1) break
    for (const dir of parseBlockLines(stripped.slice(afterStart, end))) {
      if (!seen.has(dir)) {
        seen.add(dir)
        dirs.push(dir)
      }
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + LIST_BLOCK_END.length)
  }
  return { stripped: stripped.trimEnd(), dirs }
}

export function extractGlobBlock(text: string): { stripped: string; patterns: string[] } {
  const patterns: string[] = []
  const seen = new Set<string>()
  let stripped = text
  for (;;) {
    const start = stripped.indexOf(GLOB_BLOCK_START)
    if (start === -1) break
    const afterStart = start + GLOB_BLOCK_START.length
    const end = stripped.indexOf(GLOB_BLOCK_END, afterStart)
    if (end === -1) break
    for (const pattern of parseBlockLines(stripped.slice(afterStart, end))) {
      if (!seen.has(pattern)) {
        seen.add(pattern)
        patterns.push(pattern)
      }
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + GLOB_BLOCK_END.length)
  }
  return { stripped: stripped.trimEnd(), patterns }
}

export type GitBlockCommand = 'status' | 'diff' | 'diff-staged'

export interface GitBlockRequest {
  command: GitBlockCommand
  paths: string[]
}

export function extractGitBlock(text: string): { stripped: string; requests: GitBlockRequest[] } {
  const requests: GitBlockRequest[] = []
  let stripped = text
  for (;;) {
    const start = stripped.indexOf(GIT_BLOCK_START)
    if (start === -1) break
    const afterStart = start + GIT_BLOCK_START.length
    const end = stripped.indexOf(GIT_BLOCK_END, afterStart)
    if (end === -1) break
    const lines = parseBlockLines(stripped.slice(afterStart, end))
    if (lines.length > 0) {
      const cmdRaw = lines[0].toLowerCase()
      let command: GitBlockCommand = 'status'
      if (cmdRaw === 'diff' || cmdRaw === 'diff-unstaged') command = 'diff'
      else if (cmdRaw === 'diff-staged' || cmdRaw === 'staged') command = 'diff-staged'
      else if (cmdRaw === 'status') command = 'status'
      requests.push({ command, paths: lines.slice(1) })
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + GIT_BLOCK_END.length)
  }
  return { stripped: stripped.trimEnd(), requests }
}

export interface PatchHunk {
  search: string
  replace: string
}

export interface PatchOp {
  path: string
  hunks: PatchHunk[]
}

function parsePatchHunks(inner: string): PatchHunk[] {
  const hunks: PatchHunk[] = []
  const re = /<<<< SEARCH\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>> REPLACE/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)) !== null) {
    hunks.push({ search: m[1], replace: m[2] })
  }
  return hunks
}

export function extractPatchBlocks(text: string): { stripped: string; patches: PatchOp[] } {
  const re = /<<<AI_TERMINAL_PATCH path="([^"]+)">>>\n?([\s\S]*?)<<<END_AI_TERMINAL_PATCH>>>/g
  const patches: PatchOp[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const hunks = parsePatchHunks(m[2])
    if (hunks.length > 0) patches.push({ path: m[1], hunks })
  }
  const stripped = text.replace(re, '').trimEnd()
  return { stripped, patches }
}

export interface WriteOp {
  path: string
  content: string
}

/**
 * Extrae bloques WRITE y devuelve el texto sin esos bloques.
 */
export function extractWriteBlocks(text: string): { stripped: string; writes: WriteOp[] } {
  const re = /<<<AI_TERMINAL_WRITE path="([^"]+)">>>\n?([\s\S]*?)<<<END_AI_TERMINAL_WRITE>>>/g
  const writes: WriteOp[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    writes.push({ path: m[1], content: m[2].replace(/\n$/, '') })
  }
  const stripped = text.replace(re, '').trimEnd()
  return { stripped, writes }
}

// ─── Fallback: detectar archivos desde patrones markdown comunes ─────────────

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'cs',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'env',
  'md', 'mdx', 'txt', 'sh', 'bash', 'zsh', 'fish',
  'css', 'scss', 'sass', 'less', 'html', 'htm', 'svg',
  'sql', 'graphql', 'gql', 'prisma', 'lock', 'conf', 'ini', 'cfg',
])

function isValidRelativePath(s: string): boolean {
  if (!s || s.includes(' ') || s.startsWith('/') || s.includes('..')) return false
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.\-/]*$/.test(s)) return false
  const lastDot = s.lastIndexOf('.')
  if (lastDot === -1) return false
  const ext = s.slice(lastDot + 1).toLowerCase()
  if (!ext || ext.length > 12) return false
  return CODE_EXTENSIONS.has(ext) || s.includes('/')
}

function cleanLineToPath(line: string): string | null {
  let s = line.trim()
  if (!s) return null
  s = s.replace(/^[-*+]\s+/, '')               // list bullet
  s = s.replace(/^#{1,6}\s+/, '')              // heading markers
  s = s.replace(/^(?:archivo|file|fichero|ruta|path|crear|create|editar|edit|modifica(?:r)?|contenido de|content of)\s*:?\s*/i, '')
  s = s.replace(/^\*{1,3}([^*]+)\*{1,3}$/, '$1')  // **text** / *text*
  s = s.replace(/^_{1,3}([^_]+)_{1,3}$/, '$1')    // __text__
  s = s.replace(/^`+(.+?)`+$/, '$1')              // `text`
  s = s.replace(/:$/, '').trim()
  // If there's a colon, the path might be after it (e.g. "Archivo: src/foo.ts")
  if (s.includes(':')) {
    const afterColon = s.split(':').pop()!.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim()
    if (isValidRelativePath(afterColon)) return afterColon
  }
  if (isValidRelativePath(s)) return s
  return null
}

function findCodeBlockClose(lines: string[], fromIdx: number): number {
  for (let j = fromIdx; j < lines.length; j++) {
    if (lines[j].trim() === '```') return j
  }
  return -1
}

/**
 * Fallback: detecta patrones que los modelos usan comúnmente para "mostrar un archivo"
 * sin seguir el protocolo WRITE. Soporta:
 *  - Línea con ruta (negrita, heading, backtick, texto plano) + bloque de código
 *  - ` ```ruta/archivo.ext ` (ruta como "lenguaje" del bloque)
 *  - Primer comentario del bloque es la ruta (// ruta, # ruta)
 *
 * Se aplica solo cuando no hay bloques WRITE formales en el texto.
 */
export function fallbackExtractWrites(text: string): { stripped: string; writes: WriteOp[] } {
  const writes: WriteOp[] = []
  const lines = text.split('\n')

  const lineStarts: number[] = []
  let pos = 0
  for (const line of lines) {
    lineStarts.push(pos)
    pos += line.length + 1
  }

  const toRemove: Array<[number, number]> = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Case 1: line looks like a file path indicator → next line opens a code block
    const pathFromLine = cleanLineToPath(line)
    if (pathFromLine !== null && i + 1 < lines.length && lines[i + 1].trim().startsWith('```')) {
      const closeIdx = findCodeBlockClose(lines, i + 2)
      if (closeIdx !== -1) {
        writes.push({ path: pathFromLine, content: lines.slice(i + 2, closeIdx).join('\n') })
        toRemove.push([lineStarts[i], Math.min(lineStarts[closeIdx] + lines[closeIdx].length + 1, text.length)])
        i = closeIdx + 1
        continue
      }
    }

    // Case 2: ```ruta/archivo.ext (filename as language tag)
    const langPathMatch = line.trim().match(/^```([a-zA-Z0-9_][a-zA-Z0-9_.\-/]*\.[a-zA-Z0-9]{1,12})$/)
    if (langPathMatch && isValidRelativePath(langPathMatch[1])) {
      const closeIdx = findCodeBlockClose(lines, i + 1)
      if (closeIdx !== -1) {
        writes.push({ path: langPathMatch[1], content: lines.slice(i + 1, closeIdx).join('\n') })
        toRemove.push([lineStarts[i], Math.min(lineStarts[closeIdx] + lines[closeIdx].length + 1, text.length)])
        i = closeIdx + 1
        continue
      }
    }

    // Case 3: code block whose first content line is a path comment (// path, # path, /* path */)
    if (line.trim().match(/^```\w*$/) && i + 1 < lines.length) {
      const commentMatch = lines[i + 1].match(/^(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_][a-zA-Z0-9_.\-/]*\.[a-zA-Z0-9]{1,12})\s*(?:\*\/)?$/)
      if (commentMatch && isValidRelativePath(commentMatch[1])) {
        const closeIdx = findCodeBlockClose(lines, i + 2)
        if (closeIdx !== -1) {
          writes.push({ path: commentMatch[1], content: lines.slice(i + 2, closeIdx).join('\n') })
          toRemove.push([lineStarts[i], Math.min(lineStarts[closeIdx] + lines[closeIdx].length + 1, text.length)])
          i = closeIdx + 1
          continue
        }
      }
    }

    i++
  }

  if (writes.length === 0) return { stripped: text, writes: [] }

  toRemove.sort((a, b) => a[0] - b[0])
  let stripped = ''
  let cursor = 0
  for (const [start, end] of toRemove) {
    stripped += text.slice(cursor, start)
    cursor = end
  }
  stripped += text.slice(cursor)

  return { stripped: stripped.trimEnd(), writes }
}
