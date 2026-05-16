import React from 'react'

function colorizeGraph(graph: string): React.ReactNode[] {
  return graph.split('').map((ch, i) => (
    <span
      key={i}
      className={ch === '+' ? 'git-stat-graph git-stat-graph--plus' : 'git-stat-graph git-stat-graph--minus'}
    >
      {ch}
    </span>
  ))
}

function colorizeSummaryLine(line: string): React.ReactNode {
  const m = line.match(/^(\s*)(\d+)\s+(file|files)\s+changed(.*)$/i)
  if (!m) return line
  const [, indent, fileCount, fileWord, tailRaw] = m
  const tail = tailRaw.trim()
  const chunks = tail.length
    ? tail.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <>
      {indent}
      <span className="git-stat-summary-lead">
        {fileCount} {fileWord} changed
      </span>
      {chunks.map((chunk, i) => {
        if (/\(\+\)/.test(chunk)) {
          return (
            <span key={i} className="git-stat-summary-insertions">
              {', '}
              {chunk}
            </span>
          )
        }
        if (/\(\-\)/.test(chunk)) {
          return (
            <span key={i} className="git-stat-summary-deletions">
              {', '}
              {chunk}
            </span>
          )
        }
        return (
          <span key={i} className="git-stat-summary-other">
            {', '}
            {chunk}
          </span>
        )
      })}
    </>
  )
}

function colorizeFileStatLine(line: string): React.ReactNode {
  const m = line.match(/^(\s*)(.*?)\s+\|\s+(\d+)\s+((?:\+|-)+)\s*$/)
  if (m) {
    const [, indent, path, num, graph] = m
    return (
      <>
        {indent}
        <span className="git-stat-line-path">{path}</span>
        <span className="git-stat-line-sep"> | </span>
        <span className="git-stat-line-num">{num}</span>
        {' '}
        {colorizeGraph(graph)}
      </>
    )
  }
  return line
}

function colorizeStatLine(line: string): React.ReactNode {
  if (/^\s*\d+\s+files?\s+changed/i.test(line)) {
    return colorizeSummaryLine(line)
  }
  if (line.includes('|')) {
    return colorizeFileStatLine(line)
  }
  return line
}

interface GitDiffStatBodyProps {
  text: string
}

/** Colorea líneas típicas de `git diff --stat` (+/- en barra y totales). */
export const GitDiffStatBody: React.FC<GitDiffStatBodyProps> = ({ text }) => {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 ? '\n' : null}
          {colorizeStatLine(line)}
        </React.Fragment>
      ))}
    </>
  )
}
