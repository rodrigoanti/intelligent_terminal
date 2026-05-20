/**
 * Consume un ReadableStream de bytes en formato SSE (Server-Sent Events).
 * Invoca `onData` con el contenido de cada línea `data: …`, sin el prefijo.
 * Ignora líneas vacías, `event:`, `id:` y `retry:`.
 */
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''

  function flushBuffer(): void {
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('data: ')) onData(t.slice(6))
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) lineBuffer += decoder.decode(value, { stream: !done })
    if (done) {
      lineBuffer += decoder.decode()
      flushBuffer()
      break
    }
    flushBuffer()
  }
}
