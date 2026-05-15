import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig, AgentShellPolicy } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults } from '@shared/configSchema'
import { fetchOllamaModelNames } from '@ai/ollamaModels'
import { TerminalModal } from './TerminalModal'
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
    agentMode: config.agentMode ?? false,
    agentShellPolicy: (config.agentShellPolicy ?? 'off') as AgentShellPolicy,
    thinkingMode: config.thinkingMode ?? false,
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

  useEffect(() => {
    void loadModels()
  }, [loadModels])

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

  async function handleSave(): Promise<void> {
    const updated = mergeWithDefaults({
      ...config,
      ollamaBaseURL: form.ollamaBaseURL.trim(),
      defaultModel: form.defaultModel.trim(),
      maxContextLines: Number(form.maxContextLines),
      agentMode: form.agentMode,
      agentShellPolicy: form.agentShellPolicy,
      thinkingMode: form.thinkingMode,
    })
    const errs = validateConfig(updated)
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    const result = await window.api.setConfig(updated)
    setSaving(false)

    if (result.ok) {
      onSave(updated)
      onClose()
    } else {
      setErrors(result.errors ?? ['Error al guardar'])
    }
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
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
          <section className="settings-section">
            <h3 className="settings-section-title">Ollama (IA local)</h3>

            <label className="settings-label">
              URL base de Ollama
              <input
                type="text"
                value={form.ollamaBaseURL}
                onChange={e => update('ollamaBaseURL', e.target.value)}
                placeholder="http://127.0.0.1:11434"
                spellCheck={false}
              />
              <span className="settings-hint">
                Edita también en <code>~/Library/Application Support/AI Terminal/config.json</code>
              </span>
            </label>

            <label className="settings-label">
              Modelo por defecto
              <div className="model-row">
                {showSelect && (
                  <select
                    className="model-select"
                    value={form.defaultModel}
                    disabled={modelsLoading}
                    onChange={e => update('defaultModel', e.target.value)}
                    aria-busy={modelsLoading}
                  >
                    {modelsLoading && (
                      <option value={form.defaultModel}>Cargando modelos…</option>
                    )}
                    {!modelsLoading &&
                      selectOptions.map(name => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                )}
                {modelsError && (
                  <p className="settings-model-error" role="alert">
                    No se pudo listar modelos: {modelsError}
                  </p>
                )}
                {showManualInput && (
                  <input
                    type="text"
                    className="model-manual-input"
                    value={form.defaultModel}
                    onChange={e => update('defaultModel', e.target.value)}
                    placeholder="Nombre del modelo (p. ej. llama3.2:latest)"
                    spellCheck={false}
                    aria-label="Nombre del modelo"
                  />
                )}
                <button type="button" className="model-refresh-btn" onClick={() => void loadModels()} disabled={modelsLoading}>
                  {modelsLoading ? 'Actualizando…' : 'Actualizar lista'}
                </button>
              </div>
              <span className="settings-hint">
                {showSelect
                  ? <>Modelos detectados con <code>GET /api/tags</code>. Si no aparece uno, cambia la URL y pulsa «Actualizar lista».</>
                  : <>Escribe el nombre del modelo (Ollama no respondió o no hay modelos instalados).</>}
              </span>
            </label>

            <label className="settings-label">
              Líneas de contexto (scrollback)
              <input
                type="number"
                min={10}
                max={2000}
                value={form.maxContextLines}
                onChange={e => update('maxContextLines', e.target.value)}
              />
              <span className="settings-hint">Cuántas líneas del terminal se envían al modelo como contexto.</span>
            </label>

            <label className="settings-label settings-label--checkbox">
              <span className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.agentMode}
                  onChange={e => setForm(prev => ({ ...prev, agentMode: e.target.checked }))}
                />
                Modo agente (lectura/escritura de archivos)
              </span>
              <span className="settings-hint">
                Si está activo, el chat puede leer y modificar archivos bajo el directorio de trabajo de la sesión,
                usando bloques especiales en las respuestas del modelo (solo con rutas relativas al proyecto).
              </span>
            </label>

            <label className="settings-label">
              Comandos del agente (shell)
              <select
                className="model-select"
                value={form.agentShellPolicy}
                disabled={!form.agentMode}
                onChange={e =>
                  setForm(prev => ({ ...prev, agentShellPolicy: e.target.value as AgentShellPolicy }))
                }
                aria-label="Política de ejecución de comandos del agente"
              >
                <option value="off">No ejecutar (solo archivos / texto)</option>
                <option value="ask">Preguntar antes de cada comando</option>
                <option value="always">Ejecutar siempre (sin confirmación)</option>
              </select>
              <span className="settings-hint">
                Los comandos se ejecutan en el cwd de la sesión (no en el PTY visible), con tiempo máximo y límite de salida.
                «Siempre» es peligroso en carpetas que no controlas al 100%.
              </span>
            </label>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Archivo de configuración</h3>
            <p className="settings-hint settings-hint--block">
              Los ajustes se guardan en <code>config.json</code> dentro de la carpeta de datos de la aplicación.
              Puedes editarlo directamente con cualquier editor de texto.
            </p>
            <button
              className="reveal-btn"
              onClick={() => window.api.openConfigFolder()}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Revelar carpeta de configuración en Finder
            </button>
          </section>

          {errors.length > 0 && (
            <div className="settings-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
    </TerminalModal>
  )
}
