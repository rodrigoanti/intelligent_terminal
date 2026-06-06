import React, { useEffect, useState } from 'react'
import type { AppConfig, AiProvider, Language } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, parseSpotifyPlaylistId, DEFAULT_MODEL_BY_PROVIDER } from '@shared/configSchema'
import { MUSIC_MOODS } from '@shared/musicMoods'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Icon } from './ui/Icon'
import { OllamaSection } from './settings/OllamaSection'
import { ApiKeyModelSection } from './settings/ApiKeyModelSection'
import { PROVIDER_LABELS, ANTHROPIC_MODELS, OPENAI_MODELS } from './settings/providerMeta'
import './SettingsModal.css'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
  onClose: () => void
}

const PROVIDERS: AiProvider[] = ['ollama', 'anthropic', 'openai']
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const { t } = useT()
  const [form, setForm] = useState({
    aiProvider: config.aiProvider,
    ollamaBaseURL: config.ollamaBaseURL,
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    defaultModel: config.defaultModel,
    maxContextLines: String(config.maxContextLines),
    language: config.language,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setForm({
      aiProvider: config.aiProvider,
      ollamaBaseURL: config.ollamaBaseURL,
      anthropicApiKey: config.anthropicApiKey,
      openaiApiKey: config.openaiApiKey,
      defaultModel: config.defaultModel,
      maxContextLines: String(config.maxContextLines),
      language: config.language,
      musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) },
    })
  }, [config])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors([])
  }

  function handleProviderChange(provider: AiProvider): void {
    setForm(prev => ({ ...prev, aiProvider: provider, defaultModel: DEFAULT_MODEL_BY_PROVIDER[provider] }))
    setErrors([])
  }

  function updatePlaylistMood(moodId: string, value: string): void {
    setForm(prev => ({
      ...prev,
      musicPlaylistIdsByMood: { ...prev.musicPlaylistIdsByMood, [moodId]: value },
    }))
    setErrors([])
  }

  async function handleSave(): Promise<void> {
    const musicPlaylistIdsByMood: Record<string, string> = { ...(config.musicPlaylistIdsByMood ?? {}) }
    for (const m of MUSIC_MOODS) {
      const raw = (form.musicPlaylistIdsByMood[m.id] ?? '').trim()
      if (!raw) { delete musicPlaylistIdsByMood[m.id]; continue }
      const id = parseSpotifyPlaylistId(raw)
      if (!id) {
        setErrors([t('settings.spotifyError', { label: m.label })])
        return
      }
      musicPlaylistIdsByMood[m.id] = id
    }

    const updated = mergeWithDefaults({
      ...config,
      aiProvider: form.aiProvider,
      ollamaBaseURL: form.ollamaBaseURL.trim(),
      anthropicApiKey: form.anthropicApiKey.trim(),
      openaiApiKey: form.openaiApiKey.trim(),
      defaultModel: form.defaultModel.trim(),
      maxContextLines: Number(form.maxContextLines),
      language: form.language,
      musicPlaylistIdsByMood,
    })
    const errs = validateConfig(updated)
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    const result = await window.api.setConfig(updated)
    setSaving(false)

    if (result.ok) { onSave(updated); onClose() }
    else setErrors(result.errors ?? [t('settings.errorSave')])
  }

  return (
    <TerminalModal
      open
      onClose={onClose}
      title={t('settings.title')}
      size="lg"
      zIndex={720}
      bodyLayout="spacious"
      footer={
        <div className="modal-footer">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      }
    >
      <SettingsSection title={t('settings.providerSection')}>
        <SettingsField label={t('settings.providerLabel')} hint={t('settings.providerHint')}>
          <Select
            value={form.aiProvider}
            onChange={e => handleProviderChange(e.target.value as AiProvider)}
          >
            {PROVIDERS.map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </Select>
        </SettingsField>

        {form.aiProvider === 'ollama' && (
          <OllamaSection
            baseURL={form.ollamaBaseURL}
            model={form.defaultModel}
            onBaseURLChange={v => update('ollamaBaseURL', v)}
            onModelChange={v => update('defaultModel', v)}
          />
        )}

        {form.aiProvider === 'anthropic' && (
          <ApiKeyModelSection
            keyLabel={t('settings.anthropicKeyLabel')}
            keyPlaceholder={t('settings.anthropicKeyPlaceholder')}
            keyHint={<>{t('settings.anthropicKeyHint')}</>}
            apiKey={form.anthropicApiKey}
            onApiKeyChange={v => update('anthropicApiKey', v)}
            models={ANTHROPIC_MODELS}
            modelLabel={t('settings.anthropicModelLabel')}
            model={form.defaultModel}
            onModelChange={v => update('defaultModel', v)}
          />
        )}

        {form.aiProvider === 'openai' && (
          <ApiKeyModelSection
            keyLabel={t('settings.openaiKeyLabel')}
            keyPlaceholder={t('settings.openaiKeyPlaceholder')}
            keyHint={<>{t('settings.openaiKeyHint')}</>}
            apiKey={form.openaiApiKey}
            onApiKeyChange={v => update('openaiApiKey', v)}
            models={OPENAI_MODELS}
            modelLabel={t('settings.openaiModelLabel')}
            model={form.defaultModel}
            onModelChange={v => update('defaultModel', v)}
          />
        )}

        <SettingsField
          label={t('settings.contextLinesLabel')}
          hint={t('settings.contextLinesHint')}
        >
          <Input
            type="number"
            min={10}
            max={2000}
            value={form.maxContextLines}
            onChange={e => update('maxContextLines', e.target.value)}
          />
        </SettingsField>

        <p className="settings-hint settings-hint--block">{t('settings.agentHint')}</p>
      </SettingsSection>

      <SettingsSection title={t('settings.languageSection')}>
        <SettingsField label={t('settings.languageLabel')}>
          <Select
            value={form.language}
            onChange={e => update('language', e.target.value as Language)}
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('settings.spotifySection')}>
        <p className="settings-hint settings-hint--block">{t('settings.spotifyHint')}</p>
        <div className="settings-spotify-grid">
          {MUSIC_MOODS.map(m => (
            <div key={m.id} className="settings-spotify-row">
              <SettingsField label={m.label} htmlFor={`settings-pl-${m.id}`} compact>
                <Input
                  id={`settings-pl-${m.id}`}
                  type="text"
                  placeholder={t('settings.spotifyPlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.musicPlaylistIdsByMood[m.id] ?? ''}
                  onChange={e => updatePlaylistMood(m.id, e.target.value)}
                />
              </SettingsField>
            </div>
          ))}
        </div>
        <span className="settings-hint">{t('settings.spotifyInputHint')}</span>
      </SettingsSection>

      <SettingsSection title={t('settings.configSection')}>
        <p className="settings-hint settings-hint--block">{t('settings.configHint')}</p>
        <Button variant="secondary" size="sm" onClick={() => window.api.openConfigFolder()}>
          <Icon name="folder" size={12} />
          {typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
            ? t('settings.revealConfig')
            : t('settings.revealConfigWin')}
        </Button>
      </SettingsSection>

      {errors.length > 0 && (
        <div className="settings-errors">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
    </TerminalModal>
  )
}
