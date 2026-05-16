import React, { useMemo } from 'react'

interface FileDiffViewProps {
  diff: string
}

type DiffLineKind = 'add' | 'del' | 'hunk' | 'meta' | 'ctx'

interface ParsedLine {
  kind: DiffLineKind
  text: string
}

function parseDiffLines(diff: string): ParsedLine[] {
  const out: ParsedLine[] = []
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ') || raw.startsWith('--- ')) {
      out.push({ kind: 'meta', text: raw })
    } else if (raw.startsWith('@@')) {
      out.push({ kind: 'hunk', text: raw })
    } else if (raw.startsWith('+')) {
      out.push({ kind: 'add', text: raw })
    } else if (raw.startsWith('-')) {
      out.push({ kind: 'del', text: raw })
    } else if (raw.startsWith('\\')) {
      out.push({ kind: 'meta', text: raw })
    } else {
      out.push({ kind: 'ctx', text: raw })
    }
  }
  return out
}

export const FileDiffView: React.FC<FileDiffViewProps> = ({ diff }) => {
  const lines = useMemo(() => parseDiffLines(diff), [diff])

  return (
    <pre className="file-diff-view">
      {lines.map((line, i) => (
        <div
          key={`${i}-${line.kind}`}
          className={`file-diff-view__line file-diff-view__line--${line.kind}`}
        >
          {line.text || ' '}
        </div>
      ))}
    </pre>
  )
}
