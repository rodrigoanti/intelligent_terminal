import React from 'react'
import './Spinner.css'

export interface SpinnerProps {
  'aria-label'?: string
  variant?: 'default' | 'tab'
}

export const Spinner: React.FC<SpinnerProps> = ({
  'aria-label': ariaLabel = 'Cargando',
  variant = 'default',
}) => (
  <span className={['spinner', variant === 'tab' ? 'spinner--tab' : ''].filter(Boolean).join(' ')} aria-label={ariaLabel} aria-hidden="true" />
)
