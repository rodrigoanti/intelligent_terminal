/**
 * Definiciones formales de herramientas para tool calling nativo en Anthropic y OpenAI.
 * Cada herramienta usa JSON Schema estándar como schema de entrada.
 */

export type ToolName = 'read_file' | 'write_file' | 'run_command' | 'search_files'

export interface JsonSchemaProperty {
  type: string
  description: string
}

export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required: string[]
}

export interface ToolDefinition {
  name: ToolName
  description: string
  /** JSON Schema para los parámetros de entrada de la herramienta. */
  inputSchema: JsonSchema
}

/** Conjunto canónico de herramientas disponibles para el agente. */
export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the full content of a file relative to the project root (session cwd). ' +
      'Use before modifying any existing file to avoid overwriting with stale assumptions.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the project cwd (e.g. "src/utils/helper.ts").',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write (create or overwrite) a file relative to the project root (session cwd). ' +
      'Always read_file first if the file already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the project cwd (e.g. "src/utils/helper.ts").',
        },
        content: {
          type: 'string',
          description: 'Full file content to write. Overwrites the file completely.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description:
      'Execute a shell command in the session cwd and return stdout, stderr, and exit code. ' +
      'Prefer read-only commands (ls, cat, grep, npm test). ' +
      'Do not run commands that require interactive input.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g. "npm -s test", "ls src/").',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for files by name pattern (glob) or content pattern (ripgrep) relative to the session cwd. ' +
      'Returns matching file paths or lines.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description:
            'A glob pattern (e.g. "**/*.ts") to find files by name, ' +
            'or a search string to grep inside files.',
        },
        search_type: {
          type: 'string',
          description: '"glob" to match file names (default) or "grep" to search file contents.',
        },
      },
      required: ['pattern'],
    },
  },
]

/** Convierte las definiciones al formato requerido por Anthropic. */
export function toAnthropicTools(
  tools: ToolDefinition[],
): Array<{ name: string; description: string; input_schema: JsonSchema }> {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
}

/** Convierte las definiciones al formato requerido por OpenAI. */
export function toOpenAITools(
  tools: ToolDefinition[],
): Array<{ type: 'function'; function: { name: string; description: string; parameters: JsonSchema } }> {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}
