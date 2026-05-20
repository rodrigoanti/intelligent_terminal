import React from 'react'
import { useT } from '@i18n/useT'

export const AiEmptyState: React.FC = () => {
  const { t } = useT()
  return (
    <div className="ai-chat-empty">
      <p className="ai-chat-empty-kicker">{t('ai.emptyKicker')}</p>
      <p className="ai-chat-empty-lead">{t('ai.emptyLead')}</p>
    </div>
  )
}
