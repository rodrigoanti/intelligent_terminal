import React from 'react'

interface FilePlainViewProps {
  content: string
  variant?: 'default' | 'untracked' | 'modified'
}

export const FilePlainView: React.FC<FilePlainViewProps> = ({
  content,
  variant = 'default',
}) => (
  <pre
    className={[
      'file-plain-view',
      variant === 'untracked' ? 'file-plain-view--untracked' : '',
      variant === 'modified' ? 'file-plain-view--modified' : '',
    ].filter(Boolean).join(' ')}
  >
    {content}
  </pre>
)
