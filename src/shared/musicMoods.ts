/** Claves guardadas en `AppConfig.musicPlaylistIdsByMood`. */
export const MUSIC_MOODS = [
  { id: 'focus', label: 'Enfoque' },
  { id: 'chill', label: 'Chill' },
  { id: 'energy', label: 'Energía' },
  { id: 'ambient', label: 'Ambient' },
] as const

export type MusicMoodId = (typeof MUSIC_MOODS)[number]['id']
