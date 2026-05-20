import type { ChatMessage } from '@ai/types'
import { chatAI, type AiOptions } from '@ai/aiClient'
import { extractReadBlock, extractRunBlocks, extractWriteBlocks, fallbackExtractWrites } from '@shared/agentFileProtocol'
import type { AgentShellPolicy } from '@shared/configSchema'

const MAX_AGENT_ROUNDS = 8
const MAX_WRITE_OPS = 25
const MAX_RUN_COMMANDS = 8

export interface AgentModeLoopOptions extends AiOptions {
  shellPolicy: AgentShellPolicy
  /** Obligatorio si `shellPolicy === 'ask'` */
  confirmShell?: (command: string) => Promise<boolean>
}

async function buildReadPayload(sessionId: string, paths: string[]): Promise<string> {
  const lines: string[] = [
    'The system read these files under the session cwd. Use their contents to continue (do not invent).',
    '',
  ]
  for (const p of paths) {
    lines.push(`--- FILE START: ${p} ---`)
    try {
      const r = await window.api.agentReadFile(sessionId, p)
      if (r.ok && r.content !== undefined) lines.push(r.content)
      else lines.push(`[ERROR: ${r.error ?? 'could not read'}]`)
    } catch (e) {
      lines.push(`[ERROR: ${e instanceof Error ? e.message : String(e)}]`)
    }
    lines.push(`--- FILE END: ${p} ---`, '')
  }
  return lines.join('\n')
}

async function buildShellFollowUp(
  sessionId: string,
  commands: string[],
  policy: AgentShellPolicy,
  confirmShell?: (command: string) => Promise<boolean>,
): Promise<string> {
  const lines: string[] = []
  if (policy === 'off') {
    lines.push(
      'Shell policy is **off**. No RUN block commands were executed.',
    )
    for (const c of commands) lines.push(`- skipped: \`${c}\``)
    return lines.join('\n')
  }

  for (const cmd of commands) {
    if (policy === 'ask') {
      const ok = (await confirmShell?.(cmd)) === true
      if (!ok) {
        lines.push(`### Not run\n\`${cmd}\`\n_(rejected or no confirmation)_`)
        continue
      }
    }
    try {
      const r = await window.api.agentRunShell(sessionId, cmd)
      if (r.ok) {
        lines.push(
          `### Command\n\`${cmd}\`\n**exit code:** ${r.exitCode ?? '(null)'}\n`,
        )
        if (r.stdout.trim()) lines.push('**stdout:**\n```\n' + r.stdout.trimEnd() + '\n```')
        if (r.stderr.trim()) lines.push('**stderr:**\n```\n' + r.stderr.trimEnd() + '\n```')
      } else {
        lines.push(`### Run error\n\`${cmd}\`\n${r.error}`)
      }
    } catch (e) {
      lines.push(
        `### Run error\n\`${cmd}\`\n${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }
  return lines.join('\n\n')
}

/**
 * Chat con bucle de herramientas: RUN (shell), READ (archivos) y WRITE al final.
 */
export async function runChatWithAgentFileLoop(
  initialMessages: ChatMessage[],
  sessionId: string,
  opts: AgentModeLoopOptions,
  onStreamText: (visible: string) => void,
): Promise<string> {
  const { shellPolicy, confirmShell, ...aiOpts } = opts
  let chain = [...initialMessages]
  const uiParts: string[] = []
  /** Quedó un READ/RUN pendiente y no hubo más rondas: el modelo no pudo contestar tras la última herramienta. */
  let exitedWithPendingFollowUp = false

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    let buf = ''
    await chatAI(chain, {
      ...aiOpts,
      onToken: tok => {
        buf += tok
        onStreamText([...uiParts, buf.trimEnd()].filter(Boolean).join('\n\n'))
      },
    })

    const reply = buf.trimEnd()
    const { stripped: afterRun, commands: rawRunCmds } = extractRunBlocks(reply)
    const runCommands = rawRunCmds.slice(0, MAX_RUN_COMMANDS)

    let shellUserMsg: string | null = null
    if (runCommands.length > 0) {
      shellUserMsg = await buildShellFollowUp(sessionId, runCommands, shellPolicy, confirmShell)
      if (rawRunCmds.length > MAX_RUN_COMMANDS) {
        shellUserMsg +=
          `\n\n_(${rawRunCmds.length - MAX_RUN_COMMANDS} extra RUN lines omitted; limit ${MAX_RUN_COMMANDS}.)_`
      }
    }

    const { stripped: visStripped, paths } = extractReadBlock(afterRun)
    const needsFollowUp = shellUserMsg !== null || paths.length > 0

    if (!needsFollowUp) {
      uiParts.push(reply)
      exitedWithPendingFollowUp = false
      break
    }

    uiParts.push(visStripped.trimEnd())
    exitedWithPendingFollowUp = true

    const additions: ChatMessage[] = [{ role: 'assistant', content: reply }]
    if (shellUserMsg !== null) additions.push({ role: 'user', content: shellUserMsg })
    if (paths.length > 0) additions.push({ role: 'user', content: await buildReadPayload(sessionId, paths) })
    chain = [...chain, ...additions]
  }

  let merged = uiParts.join('\n\n').trimEnd()
  if (exitedWithPendingFollowUp) {
    merged +=
      '\n\n---\n' +
      '_Agent round limit reached (' +
      String(MAX_AGENT_ROUNDS) +
      '). Send the chat again or split the task to continue._'
  }
  let { stripped, writes } = extractWriteBlocks(merged)

  // Si el modelo no usó el protocolo WRITE pero sí escribió código con patrones markdown
  // comunes (ruta + bloque, ruta como language tag, comentario de ruta), extraer igual.
  if (writes.length === 0) {
    const fallback = fallbackExtractWrites(stripped)
    if (fallback.writes.length > 0) {
      stripped = fallback.stripped
      writes = fallback.writes
    }
  }

  let finalText = stripped.trimEnd()
  const applied: string[] = []
  const writeErrs: string[] = []

  for (const w of writes.slice(0, MAX_WRITE_OPS)) {
    try {
      const r = await window.api.agentWriteFile(sessionId, w.path, w.content)
      if (r.ok) applied.push(w.path)
      else writeErrs.push(`${w.path}: ${r.error ?? 'error'}`)
    } catch (e) {
      writeErrs.push(`${w.path}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (writes.length > MAX_WRITE_OPS) {
    writeErrs.push(`(${writes.length - MAX_WRITE_OPS} writes omitted; limit ${MAX_WRITE_OPS})`)
  }

  if (applied.length > 0 || writeErrs.length > 0) {
    finalText += '\n\n---\n'
    if (applied.length > 0) {
      finalText += `\n_✓ Files written: ${applied.map(p => `\`${p}\``).join(', ')}_\n`
    }
    if (writeErrs.length > 0) {
      finalText += `\n_✗ Write errors: ${writeErrs.join('; ')}_\n`
    }
  }

  return finalText.trimEnd()
}
