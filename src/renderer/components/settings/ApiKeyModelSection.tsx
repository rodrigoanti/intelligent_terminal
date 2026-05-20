import React from 'react'
import { useT } from '@i18n/useT'
import { SettingsField } from '../SettingsSection'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { ModelOption } from './providerMeta'

interface Props {
  /** Etiqueta para el campo de API key (ej. "API key de Anthropic"). */
  keyLabel: string
  /** Placeholder para el campo de API key (ej. "sk-ant-…"). */
  keyPlaceholder: string
  /** Hint con instrucciones de dónde obtener la clave. */
  keyHint: React.ReactNode
  apiKey: string
  onApiKeyChange: (value: string) => void
  /** Modelos populares a mostrar en el select. */
  models: ModelOption[]
  /** Etiqueta del campo de modelo (ej. "Modelo de Claude"). */
  modelLabel: string
  model: string
  onModelChange: (value: string) => void
}

export const ApiKeyModelSection: React.FC<Props> = ({
  keyLabel,
  keyPlaceholder,
  keyHint,
  apiKey,
  onApiKeyChange,
  models,
  modelLabel,
  model,
  onModelChange,
}) => {
  const { t } = useT()
  const isCustomModel = !models.some(m => m.id === model)

  return (
    <>
      <SettingsField label={keyLabel} hint={keyHint}>
        <Input
          type="password"
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder={keyPlaceholder}
          spellCheck={false}
          autoComplete="off"
        />
      </SettingsField>

      <SettingsField
        label={modelLabel}
        hint={t('settings.modelCustomHint')}
      >
        <div className="model-row">
          <Select value={model} onChange={e => onModelChange(e.target.value)}>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
            {isCustomModel && (
              <option value={model}>{model}</option>
            )}
          </Select>
          <Input
            type="text"
            value={model}
            onChange={e => onModelChange(e.target.value)}
            placeholder={models[0]?.id ?? ''}
            spellCheck={false}
            aria-label={t('settings.modelCustomAriaLabel')}
          />
        </div>
      </SettingsField>
    </>
  )
}
