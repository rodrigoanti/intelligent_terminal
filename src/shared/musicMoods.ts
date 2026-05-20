/** Claves guardadas en `AppConfig.musicPlaylistIdsByMood`. */
export const MUSIC_MOODS = [
  { id: 'focus', label: 'Focus' },
  { id: 'chill', label: 'Chill' },
  { id: 'energy', label: 'Energy' },
  { id: 'ambient', label: 'Ambient' },
] as const

export type MusicMoodId = (typeof MUSIC_MOODS)[number]['id']
