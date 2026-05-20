import React from 'react'
import { Icon } from '../components/ui/Icon'
import { useT } from '@i18n/useT'

interface CdSuggestProps {
  visibleLocalDirs: string[]
  visiblePaths: string[]
  onPickLocal: (dir: string) => void
  onPickRecent: (path: string) => void
}

export const CdSuggest: React.FC<CdSuggestProps> = ({
  visibleLocalDirs,
  visiblePaths,
  onPickLocal,
  onPickRecent,
}) => {
  const { t } = useT()
  return (
    <div className="cd-suggest" role="listbox" aria-label={t('cdSuggest.ariaLabel')}>
      {visibleLocalDirs.length > 0 && (
        <>
          <div className="cd-suggest-section-title">{t('cdSuggest.currentLocation')}</div>
          {visibleLocalDirs.map(d => (
            <CdSuggestItem
              key={`local:${d}`}
              path={d}
              variant="local"
              onPick={() => onPickLocal(d)}
            />
          ))}
        </>
      )}
      {visiblePaths.length > 0 && (
        <>
          <div className="cd-suggest-section-title">{t('cdSuggest.recentLocations')}</div>
          {visiblePaths.map(p => (
            <CdSuggestItem
              key={`recent:${p}`}
              path={p}
              variant="recent"
              onPick={() => onPickRecent(p)}
            />
          ))}
        </>
      )}
    </div>
  )
}

interface CdSuggestItemProps {
  path: string
  variant: 'local' | 'recent'
  onPick: () => void
}

const CdSuggestItem: React.FC<CdSuggestItemProps> = ({ path, variant, onPick }) => (
  <button
    type="button"
    className="cd-suggest-item"
    onMouseDown={e => { e.preventDefault(); onPick() }}
    role="option"
  >
    {variant === 'local' ? (
      <span className="cd-suggest-folder-icon" aria-hidden="true">
        <Icon name="folder-filled" size={12} />
      </span>
    ) : (
      <span className="cd-suggest-prompt">~›</span>
    )}
    <span className="cd-suggest-path">{path}</span>
  </button>
)
