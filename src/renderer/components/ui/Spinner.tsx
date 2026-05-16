import React from 'react'
import './Spinner.css'

export interface SpinnerProps {
  'aria-label'?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ 'aria-label': ariaLabel = 'Cargando' }) => (
  <span className="spinner" aria-label={ariaLabel} aria-hidden="true" />
)
