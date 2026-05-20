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
  loopActive: boolean
  onToggleExpand: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onAgentToggle: (e: React.MouseEvent) => void
  onLoopToggle: (e: React.MouseEvent) => void
  onLoopStop: (e: React.MouseEvent) => void
  onThinkToggle: (e: React.MouseEvent) => void
  onShellPolicyChange: (policy: AgentShellPolicy) => void
  onDeleteHistory: (e: React.MouseEvent) => void
  canConfigPatch: boolean
}

export const AiPanelHeader: React.FC<AiPanelHeaderProps> = ({
  config,
  expanded,
  hasMessages,
  loopActive,
  onToggleExpand,
  onKeyDown,
  onAgentToggle,
  onLoopToggle,
  onLoopStop,
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
              loopActive={loopActive}
              canConfigPatch={canConfigPatch}
              onAgentToggle={onAgentToggle}
              onLoopToggle={onLoopToggle}
              onLoopStop={onLoopStop}
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
  loopActive: boolean
  canConfigPatch: boolean
  onAgentToggle: (e: React.MouseEvent) => void
  onLoopToggle: (e: React.MouseEvent) => void
  onLoopStop: (e: React.MouseEvent) => void
  onThinkToggle: (e: React.MouseEvent) => void
  onShellPolicyChange: (policy: AgentShellPolicy) => void
  onDeleteHistory: (e: React.MouseEvent) => void
}

const AiPanelActions: React.FC<AiPanelActionsProps> = ({
  config,
  hasMessages,
  loopActive,
  canConfigPatch,
  onAgentToggle,
  onLoopToggle,
  onLoopStop,
  onThinkToggle,
  onShellPolicyChange,
  onDeleteHistory,
}) => {
  const { t } = useT()
  const agentOn = config.agentMode === true

  return (
    <div className="ai-panel-actions">
      <div className="ai-panel-actions__group">
        <Toggle
          checked={agentOn}
          onChange={() => {}}
          label={t('ai.agentLabel')}
          disabled={!canConfigPatch}
          title={t('ai.agentTitle')}
          onClick={onAgentToggle}
          onKeyDown={e => e.stopPropagation()}
        />

        <Toggle
          checked={config.agentLoop === true}
          onChange={() => {}}
          label={t('ai.loopLabel')}
          disabled={!canConfigPatch || !agentOn}
          title={t('ai.loopTitle')}
          onClick={onLoopToggle}
          onKeyDown={e => e.stopPropagation()}
        />

        <div className="ai-panel-actions__shell">
          <Select
            size="sm"
            aria-label={t('ai.shellPolicyAriaLabel')}
            title={!agentOn ? t('ai.shellPolicyTitleOff') : t('ai.shellPolicyTitleOn')}
            value={config.agentShellPolicy ?? 'off'}
            disabled={!canConfigPatch || !agentOn}
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
        </div>

        <Toggle
          checked={config.thinkingMode === true}
          onChange={() => {}}
          label={t('ai.thinkLabel')}
          disabled={!canConfigPatch}
          title={t('ai.thinkTitle')}
          onClick={onThinkToggle}
          onKeyDown={e => e.stopPropagation()}
        />
      </div>

      <div className="ai-panel-actions__group ai-panel-actions__group--end">
        {loopActive && (
          <button
            type="button"
            className="ai-panel-loop-stop"
            onClick={e => { e.stopPropagation(); onLoopStop(e) }}
            title={t('ai.loopStopTitle')}
          >
            <span className="ai-panel-loop-stop__icon" aria-hidden="true">■</span>
            <span>{t('ai.loopStop')}</span>
          </button>
        )}

        {hasMessages && (
          <AiDeleteHistoryButton title={t('ai.deleteHistoryTitle')} onClick={onDeleteHistory} />
        )}
      </div>
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
