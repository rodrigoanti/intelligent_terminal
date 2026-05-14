/** Quita CSI / OSC / SS3 típicos de la entrada hacia el PTY antes de reconstruir líneas. */
export function stripAnsiInputSequences(s: string): string {
  return s
    // CSI: letras finales, `~` (p.ej. bracketed paste ESC[200~ / ESC[201~) y prefijo `?`
    .replace(/\x1b\[\??[\d;]*(?:[A-Za-z]|~)/g, '')
    // OSC terminado en BEL o ST (p.ej. OSC 11 rgb:…\x1b\\); si no se quita entero, \x1b se
    // descarta en feedCompletedUserLines y queda basura tipo "]11;rgb:…" en recientes.
    .replace(/\x1b\](?:[^\x07\x1b]|\x1b(?!\\))*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1bO[A-Za-z]/g, '')
}
