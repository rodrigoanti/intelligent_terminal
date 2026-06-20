import React from 'react'
import type { AppConfig, AgentShellPolicy } from '@shared/configSchema'
import { useT } from '@i18n/useT'
import { Toggle } from './ui/Toggle'
import { Badge } from './ui/Badge'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'

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
          icon={<Icon name="bot" size={13} />}
          compact
          disabled={!canConfigPatch}
          title={t('ai.agentTitle')}
          onClick={onAgentToggle}
          onKeyDown={e => e.stopPropagation()}
        />

        <Toggle
          checked={config.agentLoop === true}
          onChange={() => {}}
          label={t('ai.loopLabel')}
          icon={<Icon name="repeat" size={13} />}
          compact
          disabled={!canConfigPatch || !agentOn}
          title={t('ai.loopTitle')}
          onClick={onLoopToggle}
          onKeyDown={e => e.stopPropagation()}
        />

        <ShellPolicyBadgeSelector
          value={config.agentShellPolicy ?? 'off'}
          disabled={!canConfigPatch || !agentOn}
          ariaLabel={t('ai.shellPolicyAriaLabel')}
          title={!agentOn ? t('ai.shellPolicyTitleOff') : t('ai.shellPolicyTitleOn')}
          icons={{
            off: <Icon name="shield-off" size={12} />,
            ask: <Icon name="shield-question" size={12} />,
            always: <Icon name="shield-check" size={12} />,
          }}
          labels={{
            off: t('ai.shellShortOff'),
            ask: t('ai.shellShortAsk'),
            always: t('ai.shellShortAlways'),
          }}
          onChange={onShellPolicyChange}
        />

        <Toggle
          checked={config.thinkingMode === true}
          onChange={() => {}}
          label={t('ai.thinkLabel')}
          icon={<Icon name="brain" size={13} />}
          compact
          disabled={!canConfigPatch}
          title={t('ai.thinkTitle')}
          onClick={onThinkToggle}
          onKeyDown={e => e.stopPropagation()}
        />
      </div>

      <div className="ai-panel-actions__group ai-panel-actions__group--end">
        {loopActive && (
          <Tooltip content={t('ai.loopStopTitle')}>
            <button
              type="button"
              className="ai-panel-loop-stop"
              onClick={e => { e.stopPropagation(); onLoopStop(e) }}
              aria-label={t('ai.loopStop')}
            >
              <Icon name="stop" size={10} />
            </button>
          </Tooltip>
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

interface ShellPolicyBadgeSelectorProps {
  value: AgentShellPolicy
  disabled: boolean
  ariaLabel: string
  title: string
  icons: Record<AgentShellPolicy, React.ReactNode>
  labels: Record<AgentShellPolicy, string>
  onChange: (policy: AgentShellPolicy) => void
}

const SHELL_POLICIES: AgentShellPolicy[] = ['off', 'ask', 'always']

const ShellPolicyBadgeSelector: React.FC<ShellPolicyBadgeSelectorProps> = ({
  value,
  disabled,
  ariaLabel,
  title,
  icons,
  labels,
  onChange,
}) => (
  <div
    className={`ai-shell-policy-badges${disabled ? ' ai-shell-policy-badges--disabled' : ''}`}
    role="radiogroup"
    aria-label={ariaLabel}
    onClick={e => e.stopPropagation()}
    onMouseDown={e => e.stopPropagation()}
    onKeyDown={e => e.stopPropagation()}
  >
    {SHELL_POLICIES.map(policy => {
      const active = value === policy
      return (
        <Tooltip key={policy} content={`${title} — ${labels[policy]}`}>
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels[policy]}
            className={`ai-shell-policy-badge${active ? ' ai-shell-policy-badge--active' : ''}`}
            disabled={disabled}
            onClick={e => {
              e.stopPropagation()
              onChange(policy)
            }}
          >
            {icons[policy]}
          </button>
        </Tooltip>
      )
    })}
  </div>
)

const AiDeleteHistoryButton: React.FC<AiDeleteHistoryButtonProps> = ({ title, onClick }) => (
  <Tooltip content={title}>
    <button
      type="button"
      className="ai-panel-delete"
      onClick={e => { e.stopPropagation(); onClick(e) }}
      aria-label={title}
    >
      <Icon name="trash" size={11} />
    </button>
  </Tooltip>
)
