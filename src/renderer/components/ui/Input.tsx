import React from 'react'
import './Input.css'

export type InputSize = 'sm' | 'md'
export type InputVariant = 'default' | 'inline'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  size?: InputSize
  variant?: InputVariant
}

export const Input: React.FC<InputProps> = ({ size = 'md', variant = 'default', ...rest }) => (
  <input className={`input input--${size} input--${variant}`} {...rest} />
)
