import type { ProjectAiContextForAi } from '@shared/projectAiContext'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OllamaOptions {
  baseURL: string
  model: string
  onToken?: (text: string) => void
  signal?: AbortSignal
}

export async function chatOllama(
  messages: ChatMessage[],
  options: OllamaOptions
): Promise<string> {
  const base = options.baseURL.replace(/\/$/, '')
  const url = `${base}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      messages,
      stream: true,
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text}`)
  }

  if (!res.body) throw new Error('No body en la respuesta de Ollama')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        const token: string = json?.message?.content ?? ''
        if (token) {
          full += token
          options.onToken?.(token)
        }
      } catch {
        // línea NDJSON incompleta, ignorar
      }
    }
  }

  return full
}

const MAX_README_IN_SYSTEM = 14_000

/**
 * Añade contexto del cwd de la sesión (listado, package.json, README local),
 * salida reciente del terminal y README de la app (solo si no hay README en carpeta).
 */
export function enrichSystemWithContext(
  system: string,
  terminalContext: string,
  appReadmeMarkdown = '',
  workspace: ProjectAiContextForAi | null = null,
): string {
  let out = system

  if (workspace) {
    const list = workspace.listing.trim()
    if (list) {
      out += `\n\nCarpeta de trabajo de esta sesión: ${workspace.cwd}\nListado de la raíz (equivalente a ls, nombres; directorios con /):\n\`\`\`\n${list}\n\`\`\``
    }
    const pkg = workspace.packageJson?.trim()
    if (pkg) {
      out += `\n\nContenido de package.json en esa carpeta:\n\`\`\`json\n${pkg}\n\`\`\``
    }
    const localReadme = workspace.readmeMd?.trim()
    if (localReadme) {
      out += `\n\nREADME del proyecto en esa carpeta:\n\`\`\`markdown\n${localReadme.slice(0, MAX_README_IN_SYSTEM)}\n\`\`\``
    }
  }

  const appReadme = appReadmeMarkdown.trim()
  const hasLocalReadme = Boolean(workspace?.readmeMd?.trim())
  if (appReadme && !hasLocalReadme) {
    out += `\n\nDocumentación de referencia (README de la aplicación host):\n\`\`\`markdown\n${appReadme.slice(0, MAX_README_IN_SYSTEM)}\n\`\`\``
  }

  const term = terminalContext.trim()
  if (term) {
    out += `\n\nContexto actual del terminal (últimas líneas):\n\`\`\`\n${term.slice(-8000)}\n\`\`\``
  }

  return out
}

export function buildExplainPrompt(
  selectedText: string,
  terminalContext = '',
  readmeMarkdown = '',
  workspace: ProjectAiContextForAi | null = null,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: enrichSystemWithContext(
        'Eres un asistente de terminal experto. Explica en español de forma clara, concisa y corta lo que ves en la salida: prioriza pocas frases o viñetas breves; evita rodeos. Si es un error, indica causa y solución en el mínimo texto útil.',
        terminalContext,
        readmeMarkdown,
        workspace,
      ),
    },
    {
      role: 'user',
      content: `Explica esta salida de terminal:\n\`\`\`\n${selectedText}\n\`\`\``,
    },
  ]
}

export function buildCommandPrompt(
  intent: string,
  terminalContext = '',
  readmeMarkdown = '',
  workspace: ProjectAiContextForAi | null = null,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: enrichSystemWithContext(
        'Eres un asistente de terminal experto en macOS/Linux. Responde SOLO con el comando de shell exacto, sin explicaciones ni formateo markdown. Un solo comando por respuesta.',
        terminalContext,
        readmeMarkdown,
        workspace,
      ),
    },
    {
      role: 'user',
      content: intent,
    },
  ]
}

export function buildChatSystemPrompt(
  terminalContext = '',
  readmeMarkdown = '',
  workspace: ProjectAiContextForAi | null = null,
): string {
  return enrichSystemWithContext(
    'Eres un asistente de terminal experto en macOS/Linux. Responde en español de forma clara, directa, concisa y corta: prioriza pocas frases o viñetas breves; evita rodeos y párrafos largos salvo que el usuario pida más detalle.',
    terminalContext,
    readmeMarkdown,
    workspace,
  )
}
