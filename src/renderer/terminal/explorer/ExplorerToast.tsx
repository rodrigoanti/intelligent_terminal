import React, { useEffect } from 'react'

interface ExplorerToastProps {
  message: string
  onClose: () => void
}

export const ExplorerToast: React.FC<ExplorerToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const id = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(id)
  }, [message, onClose])

  return (
    <div
      className="file-explorer-toast"
      role="alert"
      onClick={onClose}
    >
      {message}
    </div>
  )
}
