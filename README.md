# AI Terminal

Terminal para macOS con integración Ollama, pestañas y temas de color.

## Requisitos

- macOS 12+
- Node.js 18+
- [Ollama](https://ollama.ai) corriendo localmente

## Desarrollo

```bash
npm install
npm run dev
```

**DevTools:** por defecto ya no se abren solos (así se evita mucho ruido en la consola del terminal por mensajes internos de Chromium). Para abrirlos: `ELECTRON_OPEN_DEVTOOLS=1 npm run dev` o **⌥⌘I** / menú Vista en la ventana de Electron si lo añades más adelante.

Los mensajes tipo `Autofill.enable wasn't found` o `language-mismatch` vienen del **DevTools embebido** cuando hay pequeñas diferencias con la versión de Electron; **no indican un fallo de tu código**.

**Atajos:** **⌘T** / **Ctrl+T** — nueva pestaña (salvo foco en input/textarea/select fuera del terminal). **⌘W** / **Ctrl+W** — con más de una pestaña cierra solo la activa; con una sola, cierra la ventana. Con DevTools abiertos y enfocados, **⌘W** sigue el comportamiento del propio DevTools.

Tras `npm install` se ejecuta **automáticamente** `electron-rebuild` para compilar `node-pty` contra la versión de Electron embebida. Si al abrir una pestaña aparece `posix_spawnp failed`, ejecuta manualmente:

```bash
npm run rebuild:native
```

## Build

```bash
npm run dist   # solo .app macOS (sin .dmg): salida en dist/mac-arm64/ y dist/mac-x64/
```

### Ícono de la aplicación

Puedes usar **PNG** cuadrado. **256×256** suele funcionar, pero en Retina puede verse más suave; mejor **512×512** o **1024×1024** para el Dock. Colócalo como:

```
build/icon.png
```

`electron-builder` lo convierte al `.icns` del `.app` al empaquetar. En desarrollo, si ese archivo existe, también se usa como ícono de la ventana. En el repositorio hay un **PNG de relleno** (512×512) para que `npm run dist` funcione sin pasos extra; sustitúyelo por tu diseño.

## Archivo de configuración

Los ajustes se guardan en:

```
~/Library/Application Support/AI Terminal/config.json
```

Puedes editarlo directamente con cualquier editor de texto. Las claves soportadas son:

| Clave | Tipo | Descripción | Default |
|---|---|---|---|
| `ollamaBaseURL` | string | URL base del servidor Ollama | `http://127.0.0.1:11434` |
| `defaultModel` | string | Modelo Ollama (en Ajustes se lista con `/api/tags`) | `llama3.2` |
| `maxContextLines` | number | Líneas de scrollback enviadas como contexto (10–2000) | `200` |
| `themeId` | string | Identificador del tema de color | `midnight` |

Ejemplo mínimo:

```json
{
  "ollamaBaseURL": "http://127.0.0.1:11434",
  "defaultModel": "llama3.2",
  "maxContextLines": 200,
  "themeId": "midnight"
}
```

Si el archivo no existe o falta alguna clave, se usan los valores por defecto automáticamente.

Desde la app puedes acceder a la carpeta vía **Ajustes → Revelar carpeta de configuración en Finder**.

## Carpetas recientes (`cd`)

Cada vez que envías un `cd` al terminal (Enter), la app resuelve la ruta absoluta y la guarda en **`user-history/cd-recent.md`** (máximo **15** entradas **sin repetir**; la más reciente arriba). El cwd lógico se infiere de tus `cd` (no del estado real del shell si un `cd` falla). La detección usa la misma secuencia de teclas que envías al PTY desde el panel.

Debajo del terminal hay la pestaña **«Carpetas recientes»**: al abrirla ves el listado; al pulsar una fila se envía `cd '…'` al PTY de esa pestaña.

Ruta en macOS:

```
~/Library/Application Support/AI Terminal/user-history/cd-recent.md
```

## Temas disponibles

| ID | Nombre |
|---|---|
| `midnight` | Midnight |
| `nord` | Nord |
| `gruvbox` | Gruvbox Dark |
| `solarDark` | Solar Dark |
| `paperLight` | Paper Light |
| `aurora` | Aurora |
