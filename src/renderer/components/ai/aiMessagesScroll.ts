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
 * - `follow` se decide antes del update de React: si el usuario estaba abajo, seguimos abajo.
 * - Sin scroll animado: al colapsar «thinking» el scrollHeight baja y `smooth` puede
 *   resetear scrollTop a 0 antes de animar (Electron/Chromium).
 * - Doble rAF: espera al layout tras cambios de altura del mensaje.
 * - Clamp previo: si el contenido se encogió, evita scrollTop > máximo.
 */
export function scrollAiMessagesToBottom(
  el: HTMLElement,
  follow: boolean | (() => boolean),
): void {
  const shouldFollow = (): boolean => typeof follow === 'function' ? follow() : follow
  if (!shouldFollow()) return
  const run = (): void => {
    // Revalidar en el frame efectivo: si el usuario scrolleó hacia arriba
    // mientras quedaba un auto-scroll pendiente, no le robamos la posición.
    if (!shouldFollow()) return
    const maxTop = getAiMessagesMaxScrollTop(el)
    el.scrollTop = Math.min(el.scrollTop, maxTop)
    el.scrollTop = maxTop
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}
