import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type AppConfig, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS, type MusicMoodId } from '@shared/musicMoods'
import './TitlebarMusicControls.css'

const SPECTRUM_BARS = 8

/** Silueta fija (sin audio real); se usa cuando no hay reproducción. */
const SPECTRUM_STATIC_LEVELS: number[] = Array.from({ length: SPECTRUM_BARS }, (_, i) => {
  const v = 0.14 + 0.11 * (0.5 + 0.5 * Math.sin(i * 0.85 + 0.3))
  return Math.round(v * 1000) / 1000
})

/**
 * Barras tipo espectro. Con `animating`, movimiento decorativo; si no, alturas fijas (sin música / pausa).
 */
function MusicPlayingSpectrum({ animating }: { animating: boolean }): React.JSX.Element {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const t0Ref = useRef(0)

  useEffect(() => {
    if (!animating) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    t0Ref.current = performance.now()
    const tick = (now: number): void => {
      const t = now - t0Ref.current
      const seed = t0Ref.current * 0.00007
      for (let i = 0; i < SPECTRUM_BARS; i++) {
        const el = barRefs.current[i]
        if (!el) continue
        const phase = t * 0.0048 + i * 0.52 + seed
        const slow = 0.5 + 0.5 * Math.sin(phase)
        const fast = 0.5 + 0.5 * Math.sin(phase * 2.31 + i * 0.4)
        const v = 0.14 + 0.42 * slow * fast + 0.18 * Math.sin(phase * 0.37 + 2)
        el.style.transform = `scaleY(${Math.max(0.1, Math.min(1, v))})`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [animating])

  return (
    <div
      className={['titlebar-music-spectrum', !animating ? 'titlebar-music-spectrum--idle' : ''].filter(Boolean).join(' ')}
      title={
        animating
          ? 'Reproduciendo: animación decorativa (Spotify no expone audio a la app).'
          : 'Sin reproducción: barras en reposo. Estado vía cliente Spotify de escritorio.'
      }
      aria-hidden
    >
      {SPECTRUM_STATIC_LEVELS.map((lv, i) => (
        <span
          key={i}
          ref={el => {
            barRefs.current[i] = el
          }}
          className="titlebar-music-spectrum__bar"
          style={animating ? undefined : { transform: `scaleY(${lv})` }}
        />
      ))}
    </div>
  )
}

interface Props {
  config: AppConfig
  /** Si hace falta configurar playlists, abrir el modal de ajustes de la app. */
  onOpenSettings?: () => void
}

export const TitlebarMusicControls: React.FC<Props> = ({ config, onOpenSettings }) => {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [playing, setPlaying] = useState(false)
  const [activeMood, setActiveMood] = useState<MusicMoodId>('focus')

  const playlistId = useMemo(() => {
    const raw = (config.musicPlaylistIdsByMood ?? {})[activeMood] ?? ''
    return parseSpotifyPlaylistId(raw) ?? ''
  }, [config.musicPlaylistIdsByMood, activeMood])

  const hasValidPlaylistId = playlistId.length === 22

  const loadingInstall = installed === null
  const noClient = installed === false

  const playPauseDisabled = installed !== true || loadingInstall

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      const [ok, st] = await Promise.all([
        window.api.spotifyDesktopInstalled(),
        window.api.spotifyGetState(),
      ])
      setInstalled(ok)
      setPlaying(ok && st.playerState === 'playing')
    } catch {
      setInstalled(false)
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    void refreshState()
    const t = window.setInterval(() => { void refreshState() }, 2000)
    return () => window.clearInterval(t)
  }, [refreshState])

  /** Siguiente estado de ánimo; pausa Spotify. La playlist del mood nuevo se reproduce al pulsar play. */
  const cycleMood = useCallback(async (): Promise<void> => {
    const ids = MUSIC_MOODS.map(m => m.id)
    const i = ids.indexOf(activeMood)
    const nextId = ids[(i + 1) % ids.length] as MusicMoodId
    setActiveMood(nextId)

    if (installed !== true) {
      void refreshState()
      return
    }
    const r = await window.api.spotifyPause()
    if (!r.ok) console.warn('[Spotify]', r.error)
    void refreshState()
  }, [activeMood, installed, refreshState])

  const onPlayPause = useCallback(async (): Promise<void> => {
    if (installed !== true) return
    if (playing) {
      const r = await window.api.spotifyPause()
      if (!r.ok) console.warn('[Spotify]', r.error)
    } else if (hasValidPlaylistId) {
      const r = await window.api.spotifyPlayPlaylist(playlistId)
      if (!r.ok) console.warn('[Spotify]', r.error)
    } else {
      onOpenSettings?.()
    }
    void refreshState()
  }, [hasValidPlaylistId, installed, onOpenSettings, playing, playlistId, refreshState])

  const moodLabel = MUSIC_MOODS.find(m => m.id === activeMood)?.label ?? activeMood

  const playPauseTitle = ((): string => {
    if (playing) return 'Pausar'
    if (hasValidPlaylistId) return `Reproducir playlist (${moodLabel})`
    return `Configura la playlist de «${moodLabel}» en Ajustes`
  })()

  if (noClient) {
    return (
      <div className="titlebar-music" title="Instala Spotify de escritorio para usar controles de música">
        <span className="titlebar-music-mood" aria-hidden>—</span>
      </div>
    )
  }

  return (
    <div className="titlebar-music">
      <button
        type="button"
        tabIndex={-1}
        className="titlebar-music-btn titlebar-music-btn--mood"
        title="Siguiente estado de ánimo. Se pausa la música; pulsa play para la playlist del mood seleccionado."
        onClick={() => void cycleMood()}
        disabled={playPauseDisabled}
      >
        <span className="titlebar-music-mood">{moodLabel}</span>
      </button>
      {installed === true && <MusicPlayingSpectrum animating={playing} />}
      <button
        type="button"
        tabIndex={-1}
        className="titlebar-music-btn"
        title={playPauseTitle}
        onClick={() => void onPlayPause()}
        disabled={playPauseDisabled}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
    </div>
  )
}
