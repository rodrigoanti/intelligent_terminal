import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { yaml } from '@codemirror/lang-yaml'
import type { Extension } from '@codemirror/state'

function fileExtension(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath
  const lower = base.toLowerCase()

  if (lower.endsWith('.d.ts')) return 'ts'
  if (lower.endsWith('.test.tsx') || lower.endsWith('.spec.tsx')) return 'tsx'
  if (lower.endsWith('.test.ts') || lower.endsWith('.spec.ts')) return 'ts'
  if (lower.endsWith('.test.jsx') || lower.endsWith('.spec.jsx')) return 'jsx'
  if (lower.endsWith('.test.js') || lower.endsWith('.spec.js')) return 'js'

  const dot = base.lastIndexOf('.')
  if (dot === -1) return ''
  return base.slice(dot + 1).toLowerCase()
}

function extensionFromExt(ext: string): Extension | null {
  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ typescript: true, jsx: true })
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'json':
    case 'jsonc':
      return json()
    case 'yml':
    case 'yaml':
      return yaml()
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return css()
    case 'html':
    case 'htm':
    case 'svg':
    case 'vue':
    case 'svelte':
      return html()
    case 'md':
    case 'mdx':
      return markdown()
    case 'py':
      return python()
    case 'rs':
      return rust()
    default:
      return null
  }
}

/** Extensión de lenguaje CodeMirror (resaltado de sintaxis) según la ruta del archivo. */
export function languageExtensionForPath(filePath: string): Extension[] {
  const ext = fileExtension(filePath)
  const lang = extensionFromExt(ext)
  return lang ? [lang] : []
}
