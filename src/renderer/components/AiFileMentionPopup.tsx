import React, { useEffect, useMemo, useRef, useState } from 'react'

interface AiFileMentionPopupProps {
  /** Lista plana de rutas de archivo disponibles (relativas al cwd del proyecto). */
  files: string[]
  /** Texto que el usuario ha escrito después del `@` (filtro de búsqueda). */
  query: string
  /** Llamado al seleccionar un archivo. */
  onSelect: (path: string) => void
  /** Llamado al cerrar el popup (Esc, clic fuera, etc.). */
  onClose: () => void
}

const MAX_RESULTS = 8

function filterFiles(files: string[], query: string): string[] {
  if (!query) return files.slice(0, MAX_RESULTS)
  const lower = query.toLowerCase()
  const scored = files
    .map(f => {
      const name = f.toLowerCase()
      // Prioriza coincidencias al final del path (nombre de archivo)
      const baseName = name.split('/').pop() ?? name
      const baseScore = baseName.startsWith(lower) ? 3 : baseName.includes(lower) ? 2 : name.includes(lower) ? 1 : 0
      return { f, score: baseScore }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, MAX_RESULTS).map(x => x.f)
}

export const AiFileMentionPopup: React.FC<AiFileMentionPopupProps> = ({
  files,
  query,
  onSelect,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  // Memoizado para evitar re-runs del efecto en cada render
  const filtered = useMemo(() => filterFiles(files, query), [files, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filtered[activeIndex]) onSelect(filtered[activeIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, activeIndex, onSelect, onClose])

  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (filtered.length === 0) return null

  return (
    <ul className="ai-mention-popup" ref={listRef} role="listbox" aria-label="File suggestions">
      {filtered.map((path, idx) => {
        const parts = path.split('/')
        const fileName = parts.pop() ?? path
        const dir = parts.join('/')
        return (
          <li
            key={path}
            role="option"
            aria-selected={idx === activeIndex}
            className={`ai-mention-popup__item ${idx === activeIndex ? 'ai-mention-popup__item--active' : ''}`}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseDown={e => { e.preventDefault(); onSelect(path) }}
          >
            <span className="ai-mention-popup__filename">{fileName}</span>
            {dir && <span className="ai-mention-popup__dir">{dir}/</span>}
          </li>
        )
      })}
    </ul>
  )
}
