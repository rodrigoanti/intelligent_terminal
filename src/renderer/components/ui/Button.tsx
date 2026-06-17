import React from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize = 'xs' | 'sm' | 'md'

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: React.ReactNode
  className?: string
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  children,
  type = 'button',
  className = '',
  ...rest
}) => (
  <button
    type={type}
    className={['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </button>
)
