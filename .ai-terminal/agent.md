--- TASKS.md ---
### 🚨 Malas Prácticas Detectadas (Nuevas)

21. **Falta de uso de `React.memo` en componentes de lista**  
   - `AiPanel.tsx`: El componente `AiMessage` no está envuelto en `React.memo`, lo que puede causar renderizados innecesarios al actualizar el estado de mensajes. Debe aplicarse para optimizar el rendimiento.

22. **No se manejan casos de error en el estado de mensajes**  
   - `AiPanel.tsx`: Si `messages` es un estado que puede estar vacío o en error, no se muestra una UI alternativa (ej: "No hay mensajes aún" o "Error al cargar mensajes").

23. **Uso de `useEffect` sin dependencias explícitas**  
   - `AiPanel.tsx`: El `useEffect` que maneja el scroll no especifica dependencias, lo que puede provocar efectos secundarios no deseados al actualizar otros estados. Debe incluirse `[]` o dependencias relevantes.

24. **Falta de encapsulación de lógica en hooks personalizados**  
   - `AiPanel.tsx`: La lógica de `handleSubmit` y `fetchAIMessage` no está encapsulada en hooks personalizados, lo que dificulta la reutilización y el mantenimiento.

25. **No se usan `useRef` para manejar referencias a elementos DOM**  
   - `AiPanel.tsx`: El scroll al final de los mensajes no usa `useRef` para acceder al elemento de chat, lo que puede causar problemas al renderizar componentes dinámicos.

26. **Falta de validación de entrada en el formulario**  
   - `AiPanel.tsx`: El input del formulario no valida que el texto no esté vacío antes de enviar (`input.trim().length === 0`).

27. **No se usan `useCallback` para funciones en `useEffect`**  
   - `AiPanel.tsx`: Las funciones pasadas como dependencias a `useEffect` no están envueltas en `useCallback`, lo que puede causar renderizados innecesarios.

28. **Falta de manejo de desplazamiento en dispositivos móviles**  
   - `AiPanel.tsx`: Si el chat se usa en móviles, no se considera el comportamiento de desplazamiento o el tamaño de la pantalla en el cálculo de `height`.

29. **No se usan `useContext` para compartir estado entre componentes**  
   - `AiPanel.tsx`: Si hay múltiples componentes que necesitan acceder al estado de mensajes o al input, no se usa `useContext` para evitar prop drilling.

30. **Falta de documentación de componentes en TypeScript**  
   - `AiMessage.tsx`: Si el componente recibe props sin tipos definidos (ej: `message`), no se usan `JSDoc` o `@param` para documentar el tipo de datos esperado.

31. **No se usan `useReducer` para estados complejos**  
   - `AiPanel.tsx`: Si el estado de mensajes o el input es complejo, no se usa `useReducer` para manejar la lógica de actualización de estado.

32. **Falta de uso de `key` en listas renderizadas**  
   - `AiPanel.tsx`: Al renderizar `messages`, no se usa un `key` único para cada elemento, lo que puede causar problemas en el rendimiento y el comportamiento de React.

33. **No se manejan eventos de desplazamiento en el chat**  
   - `AiPanel.tsx`: Si el chat es muy largo, no se considera el manejo de desplazamiento manual (ej: scroll to bottom al enviar un mensaje).

34. **Falta de uso de `useImperativeHandle` para exponer métodos a componentes padres**  
   - `AiPanel.tsx`: Si hay necesidad de controlar el chat desde un componente padre, no se usa `useImperativeHandle` para exponer métodos como `scrollToBottom`.

35. **No se usan `useLayoutEffect` para efectos que requieren renderización**  
   - `AiPanel.tsx`: El scroll al final de los mensajes no usa `useLayoutEffect`, lo que puede causar desplazamiento incorrecto en algunos navegadores.

36. **Falta de internacionalización en strings estáticos**  
   - `AiPanel.tsx`: Strings como "Enviar" o "Cargando..." no están internacionalizados, lo que limita la escalabilidad a múltiples idiomas.

37. **No se usan `useSWR` o `React Query` para manejo de datos en caché**  
   - `AiPanel.tsx`: Si `fetchAIMessage` requiere caché o refetches, no se usa una librería como `React Query` para manejar la carga de datos.

38. **Falta de uso de `useTransition` para UI con carga asincrónica**  
   - `AiPanel.tsx`: Si hay operaciones asincrónicas (ej: fetch), no se usa `useTransition` para mejorar la experiencia del usuario durante la carga.

39. **No se usan `useOptimisticUpdate` para actualizaciones optimistas**  
   - `AiPanel.tsx`: Al enviar un mensaje, no se usa `useOptimisticUpdate` para mostrar un estado provisional antes de la respuesta del servidor.

40. **Falta de uso de `useInsertionEffect` para efectos relacionados con el DOM**  
   - `AiPanel.tsx`: Si hay efectos que dependen del DOM (ej: medir tamaño de elementos), no se usa `useInsertionEffect` para garantizar el orden de ejecución.

--- END TASKS ---