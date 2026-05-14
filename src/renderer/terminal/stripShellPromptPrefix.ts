/**
 * Quita prefijos tipo `usuario@host carpeta %` que a veces incluye el modelo
 * al copiar la línea del prompt dentro del bloque de código (una o varias veces).
 * También descarta líneas iniciales que son solo prompt.
 */
export function stripLeadingShellPrompts(s: string): string {
  const lineRe = /^([A-Za-z0-9_.@+-]+@[A-Za-z0-9_.-]+\s+\S+\s*%\s*)+/
  const promptOnly = /^[A-Za-z0-9_.@+-]+@[A-Za-z0-9_.-]+\s+\S+\s*%\s*$/
  const lines = s.replace(/\r\n/g, '\n').trim().split('\n')

  while (lines.length) {
    const raw = lines[0]
    const trimmed = raw.trim()
    if (promptOnly.test(trimmed)) {
      lines.shift()
      continue
    }
    if (lineRe.test(trimmed)) {
      lines[0] = trimmed.replace(lineRe, '').trimStart()
      if (lines[0] === '') lines.shift()
      continue
    }
    break
  }

  return lines.join('\n').trim()
}
