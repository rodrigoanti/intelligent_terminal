import React from 'react'
import { GitDiffStatBody } from './GitDiffStatBody'

interface GitDiffBlocksProps {
  stagedTitle: string
  stagedBody: string
  unstagedTitle: string
  unstagedBody: string
}

export const GitDiffBlocks: React.FC<GitDiffBlocksProps> = ({
  stagedTitle,
  stagedBody,
  unstagedTitle,
  unstagedBody,
}) => (
  <div className="git-diff-blocks">
    {stagedBody.trim().length > 0 && (
      <section className="git-diff-blocks__section">
        <h3 className="git-diff-blocks__title">{stagedTitle}</h3>
        <pre className="git-diff-blocks__pre git-diff-blocks__pre--stat">
          <GitDiffStatBody text={stagedBody} />
        </pre>
      </section>
    )}
    {unstagedBody.trim().length > 0 && (
      <section className="git-diff-blocks__section">
        <h3 className="git-diff-blocks__title">{unstagedTitle}</h3>
        <pre className="git-diff-blocks__pre git-diff-blocks__pre--stat">
          <GitDiffStatBody text={unstagedBody} />
        </pre>
      </section>
    )}
  </div>
)
