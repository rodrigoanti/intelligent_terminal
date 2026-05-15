/** Marcadores para modo agente (lectura/escritura bajo el cwd de la sesión). */

export const READ_BLOCK_START = '<<<AI_TERMINAL_READ>>>'
export const READ_BLOCK_END = '<<<END_AI_TERMINAL_READ>>>'
export const RUN_BLOCK_START = '<<<AI_TERMINAL_RUN>>>'
export const RUN_BLOCK_END = '<<<END_AI_TERMINAL_RUN>>>'
export const WRITE_BLOCK_START = '<<<AI_TERMINAL_WRITE path="'
export const WRITE_BLOCK_MID = '">>>'
export const WRITE_BLOCK_END = '<<<END_AI_TERMINAL_WRITE>>>'

export interface ReadBlockResult {
  /** Texto sin el bloque READ (si había bloque). */
  stripped: string
  /** Rutas relativas solicitadas (sin duplicados). */
  paths: string[]
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

export function extractReadBlock(text: string): ReadBlockResult {
  const start = text.indexOf(READ_BLOCK_START)
  if (start === -1) return { stripped: text, paths: [] }
  const afterStart = start + READ_BLOCK_START.length
  const end = text.indexOf(READ_BLOCK_END, afterStart)
  if (end === -1) return { stripped: text, paths: [] }

  const before = text.slice(0, start).trimEnd()
  const inner = text.slice(afterStart, end)
  const seen = new Set<string>()
  const paths: string[] = []
  for (const line of inner.split('\n')) {
    const p = line.trim().replace(/^[`'"]+|[`'"]+$/g, '')
    if (!p || p.startsWith('#')) continue
    if (seen.has(p)) continue
    seen.add(p)
    paths.push(p)
  }
  return { stripped: before, paths }
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
