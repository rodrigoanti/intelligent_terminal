# Errores conocidos y mitigaciones

Historial de fallos reproducibles en **Electron + macOS** (y en parte multiplataforma) relacionados con **xterm.js**, composición de Chromium y temas. Sirve para evitar regresiones al cambiar CSS, temas o el ciclo de vida del panel de terminal.

---

## 1. Terminal xterm: no se ve lo que se escribe (“muerta” pero el PTY sí responde)

### Síntomas

- Al teclear, **no aparece texto** en la pantalla del terminal.
- A menudo **sí** hay señales de que el proceso recibe entrada (historial, sugerencias, comandos ejecutándose, eco del shell por otros medios).
- Puede ser **intermitente**, aparecer tras cambiar de tema, redimensionar, cambiar de pestaña/split o tras hot-reload en desarrollo.

### Qué *no* suele ser

- No es necesariamente fallo del shell, de `node-pty` ni del IPC de escritura al PTY.

### Causas probables (varias pueden coexistir)

| Área | Descripción |
|------|-------------|
| **Compositing / canvas** | xterm dibuja en **canvas** dentro del renderer. En Electron, capas con **transparencia**, **`backdrop-filter`** (blur) o **vibrancy** del sistema mezcladas con esa zona hacen que el **bitmap del canvas deje de actualizarse** aunque el modelo interno de xterm siga correcto. |
| **Orden en el event loop** | xterm v5 aplaza parte del trabajo de `term.write()` con `setTimeout`. Un **`requestAnimationFrame` suelto** que llama a `refresh()` **antes** de que esa escritura termine puede repintar **un frame vacío o viejo**. Por eso el repintado útil debe enlazarse al **callback de `term.write()`** cuando la entrada viene del PTY. |
| **Foco / overlays** | Otro elemento captura el teclado o un overlay bloquea interacción: mismo síntoma visual para el usuario pero la causa es **foco** o **`pointer-events`**, no el canvas. |
| **`refresh()` sobre instancia disposed** | En React (p. ej. `StrictMode`), montajes y desmontajes dobles: si un RAF usa **`termRef`** apuntando a una terminal ya **`dispose()`**, se puede corromper el estado del renderer. |

### Mitigaciones implementadas en el código

| Ubicación | Qué hace |
|-----------|----------|
| `electron/main.ts` | En macOS, **no** usar `vibrancy` / `visualEffectState` en `BrowserWindow` cuando hay terminal canvas (comentarios en código). |
| `src/themes/presets.ts` | Eliminado el tema **Apple Liquid Glass** (`appleLiquidGlass`). Función **`normalizeThemeId()`**: si el `themeId` guardado ya no existe en `THEMES`, se usa `vscodeDark`. |
| `src/renderer/App.tsx` | Al cargar la config: **`normalizeThemeId(cfg.themeId)`**; si cambia el id, **`setConfig({ themeId })`** para persistir y evitar configs huérfanas. |
| `src/renderer/terminal/TerminalPane.tsx` | **`writePtyDataWithFollowScroll(term, data, afterParsed?)`**: siempre pasa **callback** a `term.write()`; ahí se hace scroll al fondo cuando corresponde y **`scheduleTerminalCanvasRepaint`** (tras procesar la escritura). Repintado al teclear en **`term.onData`** con **`termAlive`** y la instancia **`term`** del efecto (no `termRef` dentro del RAF). Limpieza: **`termAlive = false`**, cancelar RAF pendiente, **`termRef`/`fitRef` → null** antes de **`term.dispose()`**. |
| `src/renderer/terminal/TerminalPane.css` | **`isolation: isolate`** en `.terminal-container` para aislar la composición del área del canvas respecto al resto del chrome. |
| `src/renderer/main.tsx` | Sin hoja global “liquid glass”; los temas restantes no fuerzan transparencia en la raíz para ese caso. |

### Regresiones que ya vimos

- **Quitar solo el CSS del tema** sin **normalizar `themeId`** en disco dejó usuarios con `"appleLiquidGlass"` en `config.json` mientras el renderer ya no aplicaba mitigaciones solo para ese tema: conviene que **`normalizeThemeId` + persistencia** sigan siempre activos.
- Llamar **`scheduleTerminalCanvasRepaint()`** solo **después** de `writePtyDataWithFollowScroll` **sin** pasarlo como callback de **`term.write`** volvía a dejar el canvas desfasado respecto al buffer.

### Si vuelve el problema tras cambios de UI

1. Revisar **`backdrop-filter`** en elementos que envuelvan o floten sobre **`.terminal-container` / `.xterm`**.
2. Mantener fondos **opacos** en la cadena DOM que rodea el canvas del terminal.
3. Evitar en el contenedor directo del xterm **`transform`**, **`filter`** o **`will-change`** que fuercen capas GPU problemáticas en tu versión de Electron/Chromium.
4. Confirmar que **`writePtyDataWithFollowScroll`** sigue pasando el repintado **dentro** del callback de **`term.write()`**.

---

## 2. Migración de `themeId` obsoleto

Si `~/Library/Application Support/AI Terminal/config.json` (ruta típica en macOS) contiene **`themeId`** igual a un tema eliminado (p. ej. `appleLiquidGlass`) o a un id desconocido, al arrancar la app:

1. Se normaliza a **`vscodeDark`** en memoria.
2. Se llama a **`setConfig({ themeId: 'vscodeDark' })`** para **persistir** el cambio.

El usuario puede elegir otro tema en el modal de temas.

---

## Cómo ampliar este documento

Al cerrar un bug que sea **arquitectónico** (Electron, foco, persistencia, PTY), añadir aquí una sección corta con síntoma → causa → archivo/clase responsable de la mitigación.
