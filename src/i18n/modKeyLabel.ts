/** Platform modifier key label for keyboard shortcut hints (⌘ on macOS, Ctrl elsewhere). */
export function modKeyLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return '⌘'
  }
  return 'Ctrl'
}

/** e.g. `shortcutLabel('F')` → `⌘F` or `Ctrl+F` */
export function shortcutLabel(key: string): string {
  const mod = modKeyLabel()
  return mod === 'Ctrl' ? `${mod}+${key}` : `${mod}${key}`
}
