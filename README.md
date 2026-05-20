# AI Terminal

Terminal de escritorio (Electron) con pestañas, temas, explorador de archivos, Git y panel de IA integrado (Ollama, Anthropic, OpenAI).

## Componentes

### Proceso principal (`electron/`)

| Archivo | Función |
|---------|---------|
| `main.ts` | Punto de entrada Electron: ventanas, PTY (`node-pty`), IPC, orquestación general. |
| `preload.ts` | Puente seguro: expone `window.api` al renderer sin dar acceso directo a Node. |
| `persistence.ts` | Guarda y carga sesiones, historial de chat, scrollback y log de interacciones. |
| `projectAiContext.ts` | Recopila contexto del proyecto (cwd, árbol, git, `package.json`) para la IA. |
| `agentMd.ts` | Lee/escribe `.ai-terminal/agent.md` (memoria fija del proyecto). |
| `agentFileOps.ts` | Lectura y escritura de archivos bajo el cwd de la sesión (modo agente). |
| `agentShellOps.ts` | Ejecuta comandos shell del agente con política de confirmación. |
| `gitSessionOps.ts` | Operaciones Git (status, diff, commit, push, pull). |
| `githubActionsOps.ts` | Consulta runs de GitHub Actions del repo. |
| `fileExplorerOps.ts` | Lista, lee y escribe archivos del explorador lateral. |
| `shellCwdSync.ts` | Sincroniza el cwd del terminal con el del explorador/IA. |
| `spotifyNative.ts` | Control de reproducción Spotify (macOS). |
| `cdRecentMd.ts` / `cdRecentCapture.ts` | Historial reciente de `cd` por sesión. |

### Interfaz (`src/renderer/`)

| Archivo / carpeta | Función |
|-------------------|---------|
| `App.tsx` | Layout principal: pestañas, splits, modales, estado global. |
| `components/AiPanel.tsx` | Panel de chat IA: historial, envío, modo agente, streaming. |
| `components/AiInputArea.tsx` | Campo de entrada con menciones `@archivo`. |
| `components/AiFileMentionPopup.tsx` | Autocompletado de rutas al escribir `@`. |
| `components/AiMessage.tsx` | Render de mensajes (texto, código, thinking). |
| `components/SettingsModal.tsx` | Configuración: proveedor, modelo, política shell, temas. |
| `components/GitPanelModal.tsx` | UI de Git y sugerencia de mensajes de commit con IA. |
| `terminal/TerminalPane.tsx` | Terminal xterm.js conectado al PTY por IPC. |
| `terminal/explorer/` | Explorador de archivos y editor CodeMirror integrado. |
| `ai/agentModeRunner.ts` | Bucle agente con bloques de texto `READ` / `WRITE` / `RUN`. |
| `ai/agentLoopNative.ts` | Bucle agente con tool calling nativo (Anthropic/OpenAI). |

### Clientes de IA (`src/ai/`)

| Archivo | Función |
|---------|---------|
| `aiClient.ts` | Fachada: elige proveedor (Ollama / Anthropic / OpenAI). |
| `ollamaClient.ts` | Chat streaming con Ollama, prompts del sistema, `agent.md`, modo agente. |
| `anthropicClient.ts` | Cliente Anthropic + turnos con herramientas nativas. |
| `openaiClient.ts` | Cliente OpenAI + turnos con herramientas nativas. |
| `contextBuilder.ts` | Construye el system prompt con contexto rico (árbol, git, terminal…). |
| `toolDefinitions.ts` | Definiciones de herramientas para function calling nativo. |
| `agentTypes.ts` | Tipos compartidos del bucle agente (tool calls, resultados). |

### Compartido (`src/shared/`)

| Archivo | Función |
|---------|---------|
| `ipcChannels.ts` | Nombres de canales IPC entre main y renderer. |
| `configSchema.ts` | Esquema y defaults de configuración de la app. |
| `agentFileProtocol.ts` | Marcadores `<<<AI_TERMINAL_*>>>` y parsers READ/WRITE/RUN. |
| `projectAiContext.ts` | Tipos del contexto de proyecto enviado a la IA. |
| `gitSessionTypes.ts` | Tipos y límites para operaciones Git. |

### Otros

| Ruta | Función |
|------|---------|
| `src/themes/` | Temas visuales del terminal y del editor. |
| `src/i18n/` | Traducciones (es/en) con i18next. |
| `.ai-terminal/agent.md` | Memoria del proyecto que la IA lee en cada sesión. |
| `out/` | Build generado por `electron-vite` (no editar a mano). |

## Flujo del chat con IA

1. El usuario escribe en `AiPanel`.
2. Se arma el **system prompt** (`buildChatSystemPrompt` / `contextBuilder`) con cwd, árbol, git, `agent.md`, terminal, etc.
3. Se envían mensajes al proveedor configurado (`aiClient`).
4. En **modo agente**, la respuesta puede incluir bloques `READ` / `WRITE` / `RUN` que el bucle ejecuta vía `window.api` → IPC → `electron/agent*`.

## Instalación y uso

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist   # empaquetado macOS
```
