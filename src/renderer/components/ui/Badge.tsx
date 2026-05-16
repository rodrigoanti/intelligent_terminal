import React from 'react'
import './Badge.css'

export type BadgeVariant = 'default' | 'accent' | 'muted'

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => (
  <span className={`badge badge--${variant}`}>{children}</span>
)
