import { stripAnsiInputSequences } from '@shared/ptyInputSanitize'

/**
 * Reconstruye el borrador de línea del usuario y emite líneas completas (Enter / CR / LF).
 * Debe alimentarse con los mismos bytes que se envían al PTY vía xterm `onData` / writeToTty.
 * Reconoce Ctrl+U (`\\x15`) como borrado del borrador de línea (alineado con readline/zsh).
 */
export function feedCompletedUserLines(
  prevDraft: string,
  raw: string
): { draft: string; completedLines: string[] } {
  const completedLines: string[] = []
  const data = stripAnsiInputSequences(raw)
  let draft = prevDraft

  for (const ch of data) {
    if (ch === '\r' || ch === '\n') {
      const t = draft.trim()
      if (t) completedLines.push(t)
      draft = ''
    } else if (ch === '\x15') {
      /* Ctrl+U — borrar borrador local (alineado con readline/zsh) */
      draft = ''
    } else if (ch === '\x7f' || ch === '\b') {
      draft = draft.slice(0, -1)
    } else if (ch >= ' ' && ch !== '\x7f') {
      draft += ch
    }
  }

  return { draft, completedLines }
}
