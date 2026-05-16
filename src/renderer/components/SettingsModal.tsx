import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS } from '@shared/musicMoods'
import { fetchOllamaModelNames } from '@ai/ollamaModels'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Icon } from './ui/Icon'
import './SettingsModal.css'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
  onClose: () => void
}

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [form, setForm] = useState({
    ollamaBaseURL: config.ollamaBaseURL,
    defaultModel: config.defaultModel,
    maxContextLines: String(config.maxContextLines),
    thinkingMode: config.thinkingMode ?? false,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const [debouncedBaseUrl, setDebouncedBaseUrl] = useState(form.ollamaBaseURL.trim())
  const [modelsList, setModelsList] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBaseUrl(form.ollamaBaseURL.trim()), 400)
    return () => clearTimeout(t)
  }, [form.ollamaBaseURL])

  const loadModels = useCallback(async (): Promise<void> => {
    setModelsLoading(true)
    setModelsError(null)
    setModelsList([])
    try {
      const names = await fetchOllamaModelNames(debouncedBaseUrl)
      setModelsList(names)
    } catch (e) {
      setModelsList([])
      setModelsError(e instanceof Error ? e.message : String(e))
    } finally {
      setModelsLoading(false)
    }
  }, [debouncedBaseUrl])

  useEffect(() => { void loadModels() }, [loadModels])

  const selectOptions = useMemo(() => {
    const m = form.defaultModel.trim()
    const set = new Set(modelsList)
    if (m) set.add(m)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [modelsList, form.defaultModel])

  function update(key: string, value: string): void {
    setForm(prev => ({ ...prev, [key]: value }))
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
        setErrors([`«${m.label}»: introduce un ID de 22 caracteres o un enlace open.spotify.com/playlist/…`])
        return
      }
      musicPlaylistIdsByMood[m.id] = id
    }

    const updated = mergeWithDefaults({
      ...config,
      ollamaBaseURL: form.ollamaBaseURL.trim(),
      defaultModel: form.defaultModel.trim(),
      maxContextLines: Number(form.maxContextLines),
      thinkingMode: form.thinkingMode,
      musicPlaylistIdsByMood,
    })
    const errs = validateConfig(updated)
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    const result = await window.api.setConfig(updated)
    setSaving(false)

    if (result.ok) { onSave(updated); onClose() }
    else setErrors(result.errors ?? ['Error al guardar'])
  }

  const showSelect = !modelsError && (modelsLoading || modelsList.length > 0)
  const showManualInput = Boolean(modelsError || (!modelsLoading && modelsList.length === 0))

  return (
    <TerminalModal
      open
      onClose={onClose}
      title="ajustes"
      size="lg"
      zIndex={720}
      bodyClassName="modal-body"
      footer={
        <div className="modal-footer">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <SettingsSection title="Ollama (IA local)">
        <SettingsField
          label="URL base de Ollama"
          hint={<>Edita también en <code>~/Library/Application Support/AI Terminal/config.json</code></>}
        >
          <Input
            type="text"
            value={form.ollamaBaseURL}
            onChange={e => update('ollamaBaseURL', e.target.value)}
            placeholder="http://127.0.0.1:11434"
            spellCheck={false}
          />
        </SettingsField>

        <SettingsField
          label="Modelo por defecto"
          hint={
            showSelect
              ? <>Modelos detectados con <code>GET /api/tags</code>. Si no aparece uno, cambia la URL y pulsa «Actualizar lista».</>
              : <>Escribe el nombre del modelo (Ollama no respondió o no hay modelos instalados).</>
          }
        >
          <div className="model-row">
            {showSelect && (
              <Select
                value={form.defaultModel}
                disabled={modelsLoading}
                onChange={e => update('defaultModel', e.target.value)}
                aria-busy={modelsLoading}
              >
                {modelsLoading && <option value={form.defaultModel}>Cargando modelos…</option>}
                {!modelsLoading && selectOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Select>
            )}
            {modelsError && (
              <p className="settings-model-error" role="alert">
                No se pudo listar modelos: {modelsError}
              </p>
            )}
            {showManualInput && (
              <Input
                type="text"
                value={form.defaultModel}
                onChange={e => update('defaultModel', e.target.value)}
                placeholder="Nombre del modelo (p. ej. llama3.2:latest)"
                spellCheck={false}
                aria-label="Nombre del modelo"
              />
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadModels()}
              disabled={modelsLoading}
            >
              {modelsLoading ? 'Actualizando…' : 'Actualizar lista'}
            </Button>
          </div>
        </SettingsField>

        <SettingsField
          label="Líneas de contexto (scrollback)"
          hint="Cuántas líneas del terminal se envían al modelo como contexto."
        >
          <Input
            type="number"
            min={10}
            max={2000}
            value={form.maxContextLines}
            onChange={e => update('maxContextLines', e.target.value)}
          />
        </SettingsField>

        <p className="settings-hint settings-hint--block">
          Modo agente y ejecución de comandos shell se controlan en la cabecera del panel de IA de cada terminal
          (interruptor «agente» y menú de política shell).
        </p>
      </SettingsSection>

      <SettingsSection title="Spotify (barra de título)">
        <p className="settings-hint settings-hint--block">
          IDs de playlist (22 caracteres de{' '}
          <code>open.spotify.com/playlist/…</code>). Requiere Spotify de escritorio. El nombre del mood avanza al
          pulsarlo y la reproducción se pausa; pulsa play para reproducir la playlist del mood mostrado.
        </p>
        <div className="settings-spotify-grid">
          {MUSIC_MOODS.map(m => (
            <div key={m.id} className="settings-spotify-row">
              <SettingsField
                label={m.label}
                htmlFor={`settings-pl-${m.id}`}
                compact
              >
                <Input
                  id={`settings-pl-${m.id}`}
                  type="text"
                  placeholder="p. ej. 37i9dQZF1DX4sWSpwq3LiO"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.musicPlaylistIdsByMood[m.id] ?? ''}
                  onChange={e => updatePlaylistMood(m.id, e.target.value)}
                />
              </SettingsField>
            </div>
          ))}
        </div>
        <span className="settings-hint">
          Puedes pegar el ID de 22 caracteres o el enlace completo de la playlist; al guardar se guarda solo el ID.
        </span>
      </SettingsSection>

      <SettingsSection title="Archivo de configuración">
        <p className="settings-hint settings-hint--block">
          Los ajustes se guardan en <code>config.json</code> dentro de la carpeta de datos de la aplicación.
          Puedes editarlo directamente con cualquier editor de texto.
        </p>
        <button
          type="button"
          className="reveal-btn"
          onClick={() => window.api.openConfigFolder()}
        >
          <Icon name="folder" size={12} />
          Revelar carpeta de configuración en Finder
        </button>
      </SettingsSection>

      {errors.length > 0 && (
        <div className="settings-errors">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
    </TerminalModal>
  )
}
