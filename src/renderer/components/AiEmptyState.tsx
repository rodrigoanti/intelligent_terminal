import React from 'react'

export const AiEmptyState: React.FC = () => (
  <div className="ai-chat-empty">
    <p className="ai-chat-empty-kicker">Puerta al modelo</p>
    <p className="ai-chat-empty-lead">
      Explica salidas, pide comandos o enciende el agente: la IA vive al lado del PTY, sin perder
      el contexto de esta pestaña. Con agente activo, el menú «shell» decide si se ejecutan
      comandos propuestos por el modelo (cwd de la sesión, no el PTY visible).
    </p>
  </div>
)
