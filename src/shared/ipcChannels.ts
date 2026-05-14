// IPC channel names shared between main, preload and renderer
export const IPC = {
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_ERROR: 'pty:error',
  /** Main → renderer: usuario pulsó ⌘W / Ctrl+W (cerrar pestaña o ventana según estado) */
  SHORTCUT_CLOSE_TAB: 'shortcut:close-tab',
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_OPEN_FOLDER: 'config:openFolder',
  /** Renderer → main: una línea completa enviada al PTY (para detectar `cd`) */
  CD_RECENT_RECORD_LINE: 'cdRecent:recordLine',
  /** Renderer → main: lee rutas de user-history/cd-recent.md */
  CD_RECENT_LIST: 'cdRecent:list',
  /** Renderer → main: cwd lógico de una sesión PTY */
  GET_SESSION_CWD: 'cdRecent:getCwd',
  /** Renderer → main: lista de subdirectorios del cwd actual de una sesión */
  LIST_CWD_DIRS: 'cdRecent:listCwdDirs',
  /** Renderer → main: abre una carpeta en Finder */
  OPEN_FOLDER: 'shell:openFolder',
  /** Renderer → main: contenido de README.md del proyecto (contexto IA) */
  APP_README_GET: 'app:readme',
  /** Renderer → main: listado del cwd de la sesión + package.json + README.md (contexto IA) */
  PROJECT_AI_CONTEXT_GET: 'project:aiContext',

  // ─── Persistencia de sesión ────────────────────────────────────────────────
  /** Renderer → main: guardar layout de pestañas + cwds */
  SESSION_SAVE: 'session:save',
  /** Renderer → main (invoke): cargar layout guardado */
  SESSION_LOAD: 'session:load',
  /** Renderer → main: guardar historial de chat IA de un pane */
  AI_CHAT_SAVE: 'aiChat:save',
  /** Renderer → main (invoke): cargar historial de chat IA de un pane */
  AI_CHAT_LOAD: 'aiChat:load',
  /** Renderer → main: eliminar historial de chat IA de un pane */
  AI_CHAT_DELETE: 'aiChat:delete',
  /** Renderer → main: guardar historial de comandos (no cd) de un pane */
  CMD_HISTORY_SAVE: 'cmdHistory:save',
  /** Renderer → main (invoke): cargar historial de comandos de un pane */
  CMD_HISTORY_LOAD: 'cmdHistory:load',
  /** Renderer → main: eliminar historial de comandos de un pane */
  CMD_HISTORY_DELETE: 'cmdHistory:delete',
  /** Renderer → main: guardar scrollback serializado de un pane */
  SCROLLBACK_SAVE: 'scrollback:save',
  /** Renderer → main (invoke): cargar scrollback serializado de un pane */
  SCROLLBACK_LOAD: 'scrollback:load',
  /** Renderer → main: eliminar scrollback de un pane */
  SCROLLBACK_DELETE: 'scrollback:delete',
  /** Main → renderer: pedir que el renderer serialice los scrollbacks antes de cerrar */
  APP_SAVE_BEFORE_CLOSE: 'app:saveBeforeClose',
  /** Renderer → main: datos de cierre (scrollbacks) listos para guardar */
  APP_CLOSE_READY: 'app:closeReady',
} as const
