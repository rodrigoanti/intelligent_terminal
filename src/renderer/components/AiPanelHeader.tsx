import React from 'react'
import type { AppConfig, AgentShellPolicy } from '@shared/configSchema'
import { Toggle } from './ui/Toggle'
import { Badge } from './ui/Badge'
import { Icon } from './ui/Icon'
import { Select } from './ui/Select'

interface AiPanelHeaderProps {
  config: AppConfig
  expanded: boolean
  hasMessages: boolean
  onToggleExpand: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onAgentToggle: (e: React.MouseEvent) => void
  onThinkToggle: (e: React.MouseEvent) => void
  onShellPolicyChange: (policy: AgentShellPolicy) => void
  onDeleteHistory: (e: React.MouseEvent) => void
  canConfigPatch: boolean
}

export const AiPanelHeader: React.FC<AiPanelHeaderProps> = ({
  config,
  expanded,
  hasMessages,
  onToggleExpand,
  onKeyDown,
  onAgentToggle,
  onThinkToggle,
  onShellPolicyChange,
  onDeleteHistory,
  canConfigPatch,
}) => (
  <div
    className={[
      'ai-panel-header',
      'ai-panel-header--toggle',
      expanded ? 'ai-panel-header--expanded-chrome' : 'ai-panel-header--compact-chrome',
    ].filter(Boolean).join(' ')}
    role="button"
    tabIndex={-1}
    aria-expanded={expanded}
    aria-label={expanded ? 'Ocultar panel de IA (clic en la barra)' : 'Abrir panel de IA'}
    onClick={onToggleExpand}
    onKeyDown={onKeyDown}
  >
    <div className="ai-panel-header-main">
      <div className="ai-panel-header-top">
        <AiPanelTitle modelName={config.defaultModel} />
        {expanded && (
          <AiPanelActions
            config={config}
            hasMessages={hasMessages}
            canConfigPatch={canConfigPatch}
            onAgentToggle={onAgentToggle}
            onThinkToggle={onThinkToggle}
            onShellPolicyChange={onShellPolicyChange}
            onDeleteHistory={onDeleteHistory}
          />
        )}
      </div>
    </div>
  </div>
)

interface AiPanelTitleProps {
  modelName: string
}

const AiPanelTitle: React.FC<AiPanelTitleProps> = ({ modelName }) => (
  <div className="ai-panel-title">
    <span className="ai-panel-prompt" aria-hidden="true">#</span>
    <span className="ai-panel-name">ia</span>
    <Badge variant="accent">{modelName}</Badge>
  </div>
)

interface AiPanelActionsProps {
  config: AppConfig
  hasMessages: boolean
  canConfigPatch: boolean
  onAgentToggle: (e: React.MouseEvent) => void
  onThinkToggle: (e: React.MouseEvent) => void
  onShellPolicyChange: (policy: AgentShellPolicy) => void
  onDeleteHistory: (e: React.MouseEvent) => void
}

const AiPanelActions: React.FC<AiPanelActionsProps> = ({
  config,
  hasMessages,
  canConfigPatch,
  onAgentToggle,
  onThinkToggle,
  onShellPolicyChange,
  onDeleteHistory,
}) => (
  <div className="ai-panel-actions">
    <Toggle
      checked={config.agentMode === true}
      onChange={() => {}}
      label="agente"
      disabled={!canConfigPatch}
      title="Modo agente: lectura/escritura de archivos en el cwd de la sesión. Los comandos shell dependen del menú «shell»."
      onClick={onAgentToggle}
      onKeyDown={e => e.stopPropagation()}
    />

    <Select
      size="sm"
      aria-label="Política de comandos shell del agente"
      title={
        !config.agentMode
          ? 'Activa «agente» para usar RUN. Off = no ejecutar; preguntar = confirmación por comando; siempre = sin preguntar (riesgo).'
          : 'Off = no ejecutar bloques RUN; preguntar = confirmación por comando; siempre = ejecutar sin preguntar (peligroso en cwd no confiable).'
      }
      value={config.agentShellPolicy ?? 'off'}
      disabled={!canConfigPatch || !config.agentMode}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      onChange={e => {
        e.stopPropagation()
        onShellPolicyChange(e.target.value as AgentShellPolicy)
      }}
    >
      <option value="off">shell: no</option>
      <option value="ask">shell: preguntar</option>
      <option value="always">shell: siempre</option>
    </Select>

    <Toggle
      checked={config.thinkingMode === true}
      onChange={() => {}}
      label="think"
      disabled={!canConfigPatch}
      title="Modo thinking: el modelo razona internamente antes de responder. Solo funciona con modelos compatibles (qwen3, deepseek-r1, etc.)."
      onClick={onThinkToggle}
      onKeyDown={e => e.stopPropagation()}
    />

    {hasMessages && (
      <AiDeleteHistoryButton onClick={onDeleteHistory} />
    )}
  </div>
)

interface AiDeleteHistoryButtonProps {
  onClick: (e: React.MouseEvent) => void
}

const AiDeleteHistoryButton: React.FC<AiDeleteHistoryButtonProps> = ({ onClick }) => (
  <button
    type="button"
    className="ai-panel-delete"
    onClick={e => { e.stopPropagation(); onClick(e) }}
    title="Borrar historial"
  >
    <Icon name="trash" size={11} />
  </button>
)
