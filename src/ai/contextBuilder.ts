import type { ProjectAiContextForAi } from '@shared/projectAiContext'
import type { AgentShellPolicy } from '@shared/configSchema'

/** Máximos de cada sección del system prompt. */
const MAX_FOLDER_TREE_IN_PROMPT = 15_000
const MAX_AGENT_MD_IN_SYSTEM = 22_000
const INTERACTION_LOG_SUMMARY_MAX_WORDS = 15
/** Límite del scrollback del terminal incluido en el prompt (caracteres). */
const MAX_TERMINAL_CONTEXT_CHARS = 20_000

/** Archivo incluido por una @mention del usuario. */
export interface MentionedFile {
  path: string
  content: string
}

export interface RichContextOptions {
  /** Instrucción base del asistente (sin contexto aún). */
  baseInstruction: string
  /** Scrollback del terminal — se usa completo, sin truncar. */
  terminalContext: string
  /** Contexto del proyecto: cwd, listing, package.json, folderTree, git. */
  workspace: ProjectAiContextForAi | null
  /** Contenido de .ai-terminal/agent.md (memoria del proyecto). */
  agentMd: string | null
  agentMode: boolean
  agentShellPolicy: AgentShellPolicy
  /** Resúmenes de interacciones anteriores. */
  interactionsLog: string[]
  /** Archivos adjuntados explícitamente con @path. */
  mentionedFiles?: MentionedFile[]
}

/**
 * Construye el system prompt completo con todo el contexto del proyecto.
 *
 * Orden de secciones (de más estable a más dinámico):
 *   instrucción base → árbol de carpetas → git → package.json → archivos @mencionados
 *   → agent.md → log de interacciones → scrollback del terminal
 */
export function buildRichContext(opts: RichContextOptions): string {
  const {
    baseInstruction,
    terminalContext,
    workspace,
    agentMd,
    agentMode,
    agentShellPolicy,
    interactionsLog,
    mentionedFiles = [],
  } = opts

  let out = baseInstruction

  // ── Árbol de carpetas y cwd ───────────────────────────────────────────────
  if (workspace) {
    out += `\n\nSession working directory: ${workspace.cwd}`

    const tree = workspace.folderTree?.trim()
    if (tree) {
      const truncated = tree.length > MAX_FOLDER_TREE_IN_PROMPT
        ? `${tree.slice(0, MAX_FOLDER_TREE_IN_PROMPT)}\n… (folder tree truncated)`
        : tree
      out += `\n\nProject folder tree (node_modules/.git/build artifacts omitted):\n\`\`\`\n${truncated}\n\`\`\``
    } else {
      // Fallback al listing simple si no hay árbol
      const list = workspace.listing?.trim()
      if (list) {
        out += `\n\nRoot listing (names; directories end with /):\n\`\`\`\n${list}\n\`\`\``
      }
    }

    // ── Git context ──────────────────────────────────────────────────────────
    const gitStatus = workspace.gitStatus?.trim()
    const gitDiff = workspace.gitDiff?.trim()
    if (gitStatus || gitDiff) {
      out += '\n\nGit status:'
      if (gitStatus) out += `\n\`\`\`\n${gitStatus}\n\`\`\``
      if (gitDiff) out += `\n\nChanged files summary (diff --stat):\n\`\`\`\n${gitDiff}\n\`\`\``
    }

    // ── package.json ─────────────────────────────────────────────────────────
    const pkg = workspace.packageJson?.trim()
    if (pkg) {
      out += `\n\npackage.json in that directory:\n\`\`\`json\n${pkg}\n\`\`\``
    }
  }

  // ── Archivos @mencionados ─────────────────────────────────────────────────
  if (mentionedFiles.length > 0) {
    out += '\n\nFiles attached by the user (full content):'
    for (const f of mentionedFiles) {
      out += `\n\n<file path="${f.path}">\n${f.content}\n</file>`
    }
  }

  // ── agent.md (memoria del proyecto) ──────────────────────────────────────
  const agent = agentMd?.trim()
  if (agent) {
    out += `\n\n--- start .ai-terminal/agent.md ---\n${agent.slice(0, MAX_AGENT_MD_IN_SYSTEM)}\n--- end .ai-terminal/agent.md ---`
  }

  // ── Log de interacciones previas ─────────────────────────────────────────
  if (interactionsLog.length > 0) {
    out +=
      `\n\n--- Prior interactions (AI-generated summaries, max ${INTERACTION_LOG_SUMMARY_MAX_WORDS} words each) ---\n` +
      `${interactionsLog.join('\n')}\n--- end prior interactions ---`
  }

  // ── Scrollback del terminal (limitado para no exceder el context window del modelo) ──
  const term = terminalContext.trim()
  if (term) {
    const termTruncated = term.length > MAX_TERMINAL_CONTEXT_CHARS
      ? term.slice(-MAX_TERMINAL_CONTEXT_CHARS)
      : term
    out += `\n\nCurrent terminal output (most recent lines):\n\`\`\`\n${termTruncated}\n\`\`\``
  }

  // ── Instrucciones de modo agente ─────────────────────────────────────────
  if (agentMode) {
    out += buildAgentModeInstructions(agentShellPolicy)
  }

  return out
}

function buildAgentModeInstructions(policy: AgentShellPolicy): string {
  const shellNote =
    policy === 'off'
      ? 'Shell policy is **off**: do NOT emit RUN blocks — they will be ignored.'
      : policy === 'ask'
        ? 'Shell policy is **ask**: the user must confirm each RUN block before execution.'
        : 'Shell policy is **always**: RUN blocks are executed automatically.'

  return `

--- AGENT MODE INSTRUCTIONS ---
You can read files, write files, and run shell commands in the session cwd using these markers:

**READ a file:**
<<<AI_TERMINAL_READ>>>
path/to/file.ts
<<<END_AI_TERMINAL_READ>>>

**WRITE a file** (creates/overwrites):
<<<AI_TERMINAL_WRITE path="path/to/file.ts">>>
file content here
<<<END_AI_TERMINAL_WRITE>>>

**RUN a shell command:**
<<<AI_TERMINAL_RUN>>>
npm install
<<<END_AI_TERMINAL_RUN>>>

Rules:
- **Scope:** Only WRITE files the user named in their latest message. Questions/explanations → text only, no WRITE.
- Do not fix unrelated files (e.g. do not edit ollamaClient.ts when the user only asked for README).
- **Explore:** LIST / GLOB / GREP → READ (or path:10-80) → PATCH (small edits) or WRITE (new/full file).
- Blocks: LIST, GLOB, GREP, GIT (status|diff|diff-staged), READ, RUN — follow-up with results; PATCH/WRITE applied at end.
- PATCH: <<<AI_TERMINAL_PATCH path="...">>> then <<<< SEARCH / ==== / >>>> REPLACE <<<END_AI_TERMINAL_PATCH>>>
- WRITE blocks are applied at the end of the response — do NOT expect a follow-up.
- WRITE block content must be complete valid file source — never reasoning, never partial strings.
- Only use READ when you genuinely need the file content; prefer your existing knowledge and the folder tree.
- ${shellNote}
- Paths are relative to the session cwd shown above.
--- END AGENT MODE INSTRUCTIONS ---`
}
