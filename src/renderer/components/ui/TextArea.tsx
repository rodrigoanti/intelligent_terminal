import React from 'react'
import './TextArea.css'

export type TextAreaSize = 'sm' | 'md'
export type TextAreaVariant = 'default'

export interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  size?: TextAreaSize
  variant?: TextAreaVariant
}

export const TextArea: React.FC<TextAreaProps> = ({ size = 'md', variant = 'default', ...rest }) => (
  <textarea className={`textarea textarea--${size} textarea--${variant}`} {...rest} />
)
