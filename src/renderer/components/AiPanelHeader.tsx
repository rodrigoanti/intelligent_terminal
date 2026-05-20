import React from 'react'
import type { AppConfig, AgentShellPolicy } from '@shared/configSchema'
import { useT } from '@i18n/useT'
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
}) => {
  const { t } = useT()
  return (
    <div
      className={[
        'ai-panel-header',
        'ai-panel-header--toggle',
        expanded ? 'ai-panel-header--expanded-chrome' : 'ai-panel-header--compact-chrome',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={-1}
      aria-expanded={expanded}
      aria-label={expanded ? t('ai.panelAriaHide') : t('ai.panelAriaOpen')}
      onClick={onToggleExpand}
      onKeyDown={onKeyDown}
    >
      <div className="ai-panel-header-main">
        <div className="ai-panel-header-top">
          <AiPanelTitle modelName={config.defaultModel} panelTitle={t('ai.panelTitle')} />
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
}

interface AiPanelTitleProps {
  modelName: string
  panelTitle: string
}

const AiPanelTitle: React.FC<AiPanelTitleProps> = ({ modelName, panelTitle }) => (
  <div className="ai-panel-title">
    <span className="ai-panel-prompt" aria-hidden="true">#</span>
    <span className="ai-panel-name">{panelTitle}</span>
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
}) => {
  const { t } = useT()
  return (
    <div className="ai-panel-actions">
      <Toggle
        checked={config.agentMode === true}
        onChange={() => {}}
        label={t('ai.agentLabel')}
        disabled={!canConfigPatch}
        title={t('ai.agentTitle')}
        onClick={onAgentToggle}
        onKeyDown={e => e.stopPropagation()}
      />

      <Select
        size="sm"
        aria-label={t('ai.shellPolicyAriaLabel')}
        title={!config.agentMode ? t('ai.shellPolicyTitleOff') : t('ai.shellPolicyTitleOn')}
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
        <option value="off">{t('ai.shellNo')}</option>
        <option value="ask">{t('ai.shellAsk')}</option>
        <option value="always">{t('ai.shellAlways')}</option>
      </Select>

      <Toggle
        checked={config.thinkingMode === true}
        onChange={() => {}}
        label={t('ai.thinkLabel')}
        disabled={!canConfigPatch}
        title={t('ai.thinkTitle')}
        onClick={onThinkToggle}
        onKeyDown={e => e.stopPropagation()}
      />

      {hasMessages && (
        <AiDeleteHistoryButton title={t('ai.deleteHistoryTitle')} onClick={onDeleteHistory} />
      )}
    </div>
  )
}

interface AiDeleteHistoryButtonProps {
  title: string
  onClick: (e: React.MouseEvent) => void
}

const AiDeleteHistoryButton: React.FC<AiDeleteHistoryButtonProps> = ({ title, onClick }) => (
  <button
    type="button"
    className="ai-panel-delete"
    onClick={e => { e.stopPropagation(); onClick(e) }}
    title={title}
  >
    <Icon name="trash" size={11} />
  </button>
)
