import React from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize = 'xs' | 'sm' | 'md'

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`btn btn--${variant} btn--${size}`}
    {...rest}
  >
    {children}
  </button>
)
