> **Última revisión de este README:** 14 de mayo de 2026.

## Panel de IA (Ollama) — qué se envía en cada mensaje

El chat visible en la interfaz **no** se reenvía como historial completo a Ollama. En cada envío se construye:

- Un mensaje **system** con: instrucciones base, carpeta de trabajo (`cwd`), listado de la raíz, contenido de `package.json` si existe, el archivo `.ai-terminal/agent.md` (hasta ~22 000 caracteres), un **resumen** de interacciones anteriores (máx. 120 entradas; cada una resume pregunta y respuesta en **≤10 palabras**), las **últimas líneas del scrollback** del terminal (hasta ~8 000 caracteres) y, si está activo el modo agente, las reglas de READ/WRITE/RUN.
- Un único mensaje **user** con el texto que acabas de escribir (en modo “explicar selección”, el contenido seleccionado).

Por eso una respuesta puede parecer “de otro contexto”: el modelo prioriza el **system** (terminal, `agent.md`, resúmenes viejos) y **no ve** los mensajes anteriores del hilo salvo lo que quedó en ese resumen. Si en el terminal o en `agent.md` hay texto largo (por ejemplo documentación de firma de código), el modelo puede enlazarse a eso aunque tu pregunta sea otra.

## ⚠️ Notas Importantes (actualizado)

- **Firma de código (macOS)**: Para distribuir aplicaciones en macOS, se requiere una firma con un certificado válido de Apple. Si no se firma, podrían surgir problemas con la seguridad del sistema operativo.

  **Solución para el problema de firma:**
  1. **Obtén un certificado de Apple Developer** desde [Apple Developer](https://developer.apple.com/).
  2. **Configura `electron-builder`** para usar el certificado:
     - Asegúrate de que el certificado esté instalado en tu Keychain.
     - Configura la opción `signingIdentity` en `electron-builder` (ejemplo: `"Apple Development: Tu Nombre (XXXXXXXXXX)"`).
     - Puedes usar la herramienta [electron-notarize](https://github.com/electron/electron-notarize) para notarizar la aplicación después del empaquetado.

- **Dependencias nativas**: Asegúrate de compilar las dependencias nativas con `npm run rebuild` antes de empacar, especialmente en sistemas Windows o macOS.

## 📦 Empaquetado (actualizado)

- **Windows**: `dist/windows` (`.exe`)
- **macOS**: `dist/mac-arm64` (`.app` para Apple Silicon) o `dist/mac` (`.app` para Intel)
- **Linux**: `dist/linux` (`.deb`, `.rpm`)

## 🛠️ Configuración Adicional

### Ejemplo de configuración de `electron-builder` para firma de código:
```json
{
  "mac": {
    "signingHashAlgorithm": "sha256",
    "signingIdentity": "Apple Development: Tu Nombre (XXXXXXXXXX)",
    "entitlements": "build/entitlements.mac.plist",
    "hardenedRuntime": true
  }
}
```
