import React from 'react'
import './Select.css'

export type SelectSize = 'sm' | 'md'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'size'> {
  size?: SelectSize
  children: React.ReactNode
}

export const Select: React.FC<SelectProps> = ({ size = 'md', children, ...rest }) => (
  <select className={`select select--${size}`} {...rest}>
    {children}
  </select>
)
