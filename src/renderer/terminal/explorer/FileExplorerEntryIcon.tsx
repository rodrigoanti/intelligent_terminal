import React from 'react'
import { Icon } from '../../components/ui/Icon'

interface FileExplorerEntryIconProps {
  name: string
  isDirectory: boolean
  expanded?: boolean
}

interface FileIconMeta {
  label: string
  className: string
}

function fileExtension(name: string): string {
  const lower = name.toLowerCase()

  if (lower.endsWith('.d.ts')) return 'ts'
  if (lower.endsWith('.test.tsx') || lower.endsWith('.spec.tsx')) return 'tsx'
  if (lower.endsWith('.test.ts') || lower.endsWith('.spec.ts')) return 'ts'
  if (lower.endsWith('.test.jsx') || lower.endsWith('.spec.jsx')) return 'jsx'
  if (lower.endsWith('.test.js') || lower.endsWith('.spec.js')) return 'js'

  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot + 1).toLowerCase()
}

function fileIconMeta(name: string): FileIconMeta {
  const lower = name.toLowerCase()
  const ext = fileExtension(name)

  if (lower === 'package.json' || lower === 'package-lock.json') {
    return { label: 'npm', className: 'file-explorer-entry-icon--npm' }
  }
  if (lower.startsWith('tsconfig') && lower.endsWith('.json')) {
    return { label: 'ts', className: 'file-explorer-entry-icon--ts' }
  }
  if (lower === '.gitignore' || lower === '.gitattributes') {
    return { label: 'git', className: 'file-explorer-entry-icon--git' }
  }
  if (lower === 'dockerfile' || lower.endsWith('.dockerfile')) {
    return { label: 'docker', className: 'file-explorer-entry-icon--docker' }
  }
  if (lower === 'readme.md') {
    return { label: 'md', className: 'file-explorer-entry-icon--md' }
  }

  switch (ext) {
    case 'tsx':
      return { label: 'tsx', className: 'file-explorer-entry-icon--tsx' }
    case 'ts':
    case 'mts':
    case 'cts':
      return { label: 'ts', className: 'file-explorer-entry-icon--ts' }
    case 'jsx':
      return { label: 'jsx', className: 'file-explorer-entry-icon--jsx' }
    case 'js':
    case 'mjs':
    case 'cjs':
      return { label: 'js', className: 'file-explorer-entry-icon--js' }
    case 'json':
    case 'jsonc':
      return { label: 'json', className: 'file-explorer-entry-icon--json' }
    case 'css':
      return { label: 'css', className: 'file-explorer-entry-icon--css' }
    case 'scss':
    case 'sass':
      return { label: 'scss', className: 'file-explorer-entry-icon--scss' }
    case 'less':
      return { label: 'less', className: 'file-explorer-entry-icon--less' }
    case 'html':
    case 'htm':
      return { label: 'html', className: 'file-explorer-entry-icon--html' }
    case 'md':
    case 'mdx':
      return { label: 'md', className: 'file-explorer-entry-icon--md' }
    case 'py':
      return { label: 'py', className: 'file-explorer-entry-icon--py' }
    case 'rs':
      return { label: 'rs', className: 'file-explorer-entry-icon--rs' }
    case 'yml':
    case 'yaml':
      return { label: 'yml', className: 'file-explorer-entry-icon--yml' }
    case 'svg':
      return { label: 'svg', className: 'file-explorer-entry-icon--svg' }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
      return { label: 'img', className: 'file-explorer-entry-icon--image' }
    case 'vue':
      return { label: 'vue', className: 'file-explorer-entry-icon--vue' }
    case 'sql':
      return { label: 'sql', className: 'file-explorer-entry-icon--sql' }
    case 'sh':
    case 'bash':
    case 'zsh':
      return { label: 'sh', className: 'file-explorer-entry-icon--shell' }
    case 'go':
      return { label: 'go', className: 'file-explorer-entry-icon--go' }
    case 'toml':
      return { label: 'toml', className: 'file-explorer-entry-icon--toml' }
    case 'lock':
      return { label: 'lock', className: 'file-explorer-entry-icon--lock' }
    default:
      return {
        label: ext ? ext.slice(0, 3) : 'file',
        className: 'file-explorer-entry-icon--default',
      }
  }
}

export const FileExplorerEntryIcon: React.FC<FileExplorerEntryIconProps> = ({
  name,
  isDirectory,
  expanded = false,
}) => {
  if (isDirectory) {
    return (
      <span
        className={[
          'file-explorer-entry-icon',
          'file-explorer-entry-icon--folder',
          expanded ? 'file-explorer-entry-icon--folder-open' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden
      >
        <Icon name={expanded ? 'folder-filled' : 'folder'} size={13} />
      </span>
    )
  }

  const meta = fileIconMeta(name)

  return (
    <span
      className={['file-explorer-entry-icon', 'file-explorer-entry-icon--file', meta.className].join(' ')}
      aria-hidden
    >
      <span className="file-explorer-entry-icon__label">{meta.label}</span>
    </span>
  )
}
