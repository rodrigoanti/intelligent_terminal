/** Segmento de línea que ejecuta `clear` (con o sin argumentos). */
function segmentIsClear(seg: string): boolean {
  return /^\s*(?:builtin\s+|command\s+)?clear(?:\s|$)/i.test(seg.trim())
}

/** True si la línea enviada al PTY incluye `clear` (p. ej. `clear`, `clear; ls`). */
export function isClearCommandLine(line: string): boolean {
  const segments = line.split(';').map(s => s.trim()).filter(Boolean)
  return segments.some(segmentIsClear)
}
