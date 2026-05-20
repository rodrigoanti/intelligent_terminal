import React, { useRef, useEffect } from 'react';

const AiPanel: React.FC = () => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleExpand = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };

    // Ejemplo: si el componente se expande al hacer clic en un botón
    // Reemplazar con la lógica real de expansión de tu aplicación
    const expandButton = document.querySelector('#expand-button');
    if (expandButton) {
      expandButton.addEventListener('click', handleExpand);
    }

    return () => {
      if (expandButton) {
        expandButton.removeEventListener('click', handleExpand);
      }
    };
  }, []);

  return (
    <div ref={chatContainerRef} style={{ overflowY: 'auto', height: '300px' }}>
      {/* Mensajes del chat van aquí */}
      <div>Mensaje 1</div>
      <div>Mensaje 2</div>
      <div>Mensaje 3</div>
    </div>
  );
};

export default AiPanel;