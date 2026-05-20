/**
 * Definiciones formales de herramientas para tool calling nativo en Anthropic y OpenAI.
 */

export type ToolName =
  | 'read_file'
  | 'read_file_lines'
  | 'write_file'
  | 'patch_file'
  | 'run_command'
  | 'search_files'
  | 'list_directory'
  | 'git_status'
  | 'git_diff'

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
  inputSchema: JsonSchema
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read full file content relative to session cwd. Use before editing.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file_lines',
    description: 'Read a line range (1-indexed) from a large file.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        start_line: { type: 'string', description: 'First line (1-indexed).' },
        end_line: { type: 'string', description: 'Last line (1-indexed).' },
      },
      required: ['path', 'start_line', 'end_line'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file. Prefer patch_file for small edits.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'patch_file',
    description: 'Apply exact search/replace in a file. Search must match exactly once.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        search: { type: 'string', description: 'Exact text to find.' },
        replace: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'search', 'replace'],
    },
  },
  {
    name: 'run_command',
    description: 'Run shell in session cwd (npm test, build, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_files',
    description: 'Grep or glob: derive patterns from user request before read_file.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Grep string or glob like **/*.ts' },
        search_type: { type: 'string', description: '"grep" or "glob".' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_directory',
    description: 'List children of a directory relative to cwd.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path or "." for root.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'git_status',
    description: 'Git status and diff stat for the repo.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'git_diff',
    description: 'Git diff (unstaged or staged) optionally for specific paths.',
    inputSchema: {
      type: 'object',
      properties: {
        staged: { type: 'string', description: '"true" for staged diff.' },
        paths: { type: 'string', description: 'Comma-separated relative paths.' },
      },
      required: [],
    },
  },
]

export function toAnthropicTools(
  tools: ToolDefinition[],
): Array<{ name: string; description: string; input_schema: JsonSchema }> {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
}

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
