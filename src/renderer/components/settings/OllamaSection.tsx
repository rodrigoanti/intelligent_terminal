import React from 'react'
import { useT } from '@i18n/useT'
import { SettingsField } from '../SettingsSection'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useOllamaModels, useOllamaSelectOptions } from './useOllamaModels'

interface Props {
  baseURL: string
  model: string
  onBaseURLChange: (value: string) => void
  onModelChange: (value: string) => void
}

export const OllamaSection: React.FC<Props> = ({
  baseURL,
  model,
  onBaseURLChange,
  onModelChange,
}) => {
  const { t } = useT()
  const { models, loading, error, reload } = useOllamaModels(baseURL, true)
  const selectOptions = useOllamaSelectOptions(models, model)

  const showSelect = !error && (loading || models.length > 0)
  const showManualInput = Boolean(error || (!loading && models.length === 0))

  return (
    <>
      <SettingsField
        label={t('settings.ollamaUrlLabel')}
        hint={<>{t('settings.ollamaUrlHint')}</>}
      >
        <Input
          type="text"
          value={baseURL}
          onChange={e => onBaseURLChange(e.target.value)}
          placeholder={t('settings.ollamaUrlPlaceholder')}
          spellCheck={false}
        />
      </SettingsField>

      <SettingsField
        label={t('settings.ollamaModelLabel')}
        hint={showSelect ? t('settings.ollamaModelHintSelect') : t('settings.ollamaModelHintManual')}
      >
        <div className="model-row">
          {showSelect && (
            <Select
              value={model}
              disabled={loading}
              onChange={e => onModelChange(e.target.value)}
              aria-busy={loading}
            >
              {loading && <option value={model}>{t('settings.ollamaLoadingModels')}</option>}
              {!loading && selectOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Select>
          )}
          {error && (
            <p className="settings-model-error" role="alert">
              {t('settings.ollamaModelError', { error })}
            </p>
          )}
          {showManualInput && (
            <Input
              type="text"
              value={model}
              onChange={e => onModelChange(e.target.value)}
              placeholder={t('settings.ollamaModelPlaceholder')}
              spellCheck={false}
              aria-label={t('settings.ollamaModelAriaLabel')}
            />
          )}
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            {loading ? t('settings.ollamaRefreshing') : t('settings.ollamaRefresh')}
          </Button>
        </div>
      </SettingsField>
    </>
  )
}
