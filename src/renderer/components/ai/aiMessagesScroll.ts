export const AI_MESSAGES_NEAR_BOTTOM_PX = 64

export function getAiMessagesMaxScrollTop(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.clientHeight)
}

export function isAiMessagesNearBottom(
  el: HTMLElement,
  thresholdPx = AI_MESSAGES_NEAR_BOTTOM_PX,
): boolean {
  const maxTop = getAiMessagesMaxScrollTop(el)
  return maxTop - el.scrollTop <= thresholdPx
}

/**
 * Sigue el fondo del chat sin saltos al terminar el streaming.
 * - Sin scroll animado: al colapsar «thinking» el scrollHeight baja y `smooth` puede
 *   resetear scrollTop a 0 antes de animar (Electron/Chromium).
 * - Doble rAF: espera al layout tras cambios de altura del mensaje.
 * - Clamp previo: si el contenido se encogió, evita scrollTop > máximo.
 */
export function scrollAiMessagesToBottom(el: HTMLElement, force: boolean): void {
  const run = (): void => {
    const maxTop = getAiMessagesMaxScrollTop(el)
    if (!force && !isAiMessagesNearBottom(el)) return
    el.scrollTop = Math.min(el.scrollTop, maxTop)
    el.scrollTop = maxTop
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}
