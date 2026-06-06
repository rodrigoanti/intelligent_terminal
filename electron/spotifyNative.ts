import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const PLAYLIST_ID_RE = /^[a-zA-Z0-9]{22}$/

export function assertPlaylistId(id: string): void {
  const t = id.trim()
  if (!PLAYLIST_ID_RE.test(t)) throw new Error('ID de playlist de Spotify no válido (22 caracteres alfanuméricos).')
}

/** Si es una URL https de playlist pública, devuelve `spotify:playlist:…`; si no, null. */
export function tryResolveSpotifyPlaylistUriFromHttpUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!/^open\.spotify\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/^\/playlist\/([a-zA-Z0-9]{22})\/?(?:\?.*)?$/i)
    return m ? `spotify:playlist:${m[1]}` : null
  } catch {
    return null
  }
}

export type SpotifyPlaybackState = {
  installed: boolean
  appRunning: boolean
  playerState: 'playing' | 'paused' | 'stopped' | 'unknown'
  trackName?: string
}

async function macSpotifyProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to return (name of processes) contains "Spotify"',
    ])
    return stdout.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

async function macSpotifyPlayPlaylist(playlistId: string): Promise<void> {
  assertPlaylistId(playlistId)
  const uri = `spotify:playlist:${playlistId.trim()}`
  const running = await macSpotifyProcessRunning()
  if (running) {
    await execFileAsync('osascript', [
      '-e',
      `tell application "Spotify" to play track "${uri}"`,
    ])
  } else {
    await execFileAsync('osascript', [
      '-e',
      'tell application "Spotify" to activate',
      '-e',
      'delay 0.45',
      '-e',
      `tell application "Spotify" to play track "${uri}"`,
    ])
  }
}

async function macSpotifyPause(): Promise<void> {
  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to pause'])
}

async function macSpotifyPlay(): Promise<void> {
  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to play'])
}

async function macSpotifyGetState(): Promise<Omit<SpotifyPlaybackState, 'installed'>> {
  const appRunning = await macSpotifyProcessRunning()
  if (!appRunning) {
    return { appRunning: false, playerState: 'stopped' }
  }
  try {
    // Comparar el enum `player state` explícitamente: `as string` falla o devuelve basura en algunas versiones/localizaciones.
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `tell application "Spotify"
  set n to ""
  try
    set n to name of current track as string
  end try
  if player state is playing then
    return "playing" & tab & n
  else if player state is paused then
    return "paused" & tab & n
  else
    return "stopped" & tab & n
  end if
end tell`,
    ])
    const [rawState, ...nameParts] = stdout.trim().split('\t')
    const trackName = nameParts.join('\t') || undefined
    const st = rawState?.toLowerCase() ?? ''
    let playerState: SpotifyPlaybackState['playerState'] = 'unknown'
    if (st === 'playing') playerState = 'playing'
    else if (st === 'paused') playerState = 'paused'
    else if (st === 'stopped') playerState = 'stopped'
    return { appRunning: true, playerState, trackName }
  } catch {
    return { appRunning: true, playerState: 'unknown' }
  }
}

async function macSpotifyDesktopInstalled(): Promise<boolean> {
  if (existsSync('/Applications/Spotify.app')) return true
  try {
    const { stdout } = await execFileAsync('mdfind', [
      "kMDItemCFBundleIdentifier == 'com.spotify.client'",
    ])
    return Boolean(stdout.trim())
  } catch {
    return false
  }
}

async function winSendMediaKey(vk: string): Promise<void> {
  await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
[K]::keybd_event(${vk},0,0,[UIntPtr]::Zero)
[K]::keybd_event(${vk},0,2,[UIntPtr]::Zero)`,
  ])
}

async function winSendMediaPlayPause(): Promise<void> {
  await winSendMediaKey('0xB3')
}

async function winSendMediaPlay(): Promise<void> {
  await winSendMediaKey('0xB0')
}

async function winSendMediaPause(): Promise<void> {
  await winSendMediaKey('0xB2')
}

async function winPlayPlaylist(playlistId: string): Promise<void> {
  assertPlaylistId(playlistId)
  const uri = `spotify:playlist:${playlistId.trim()}`
  await execFileAsync('cmd', ['/c', 'start', '', uri], { windowsHide: true })
}

async function winSpotifyDesktopInstalled(): Promise<boolean> {
  const local = process.env.LOCALAPPDATA
  if (local && existsSync(`${local}\\Spotify\\Spotify.exe`)) return true
  const pf = process.env.PROGRAMFILES
  if (pf && existsSync(`${pf}\\Spotify\\Spotify.exe`)) return true
  const pfx86 = process.env['PROGRAMFILES(X86)']
  if (pfx86 && existsSync(`${pfx86}\\Spotify\\Spotify.exe`)) return true
  return false
}

async function winSpotifyProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('tasklist', [
      '/FI',
      'IMAGENAME eq Spotify.exe',
      '/FO',
      'CSV',
      '/NH',
    ])
    return stdout.toLowerCase().includes('spotify.exe')
  } catch {
    return false
  }
}

async function linuxPlayPlaylist(playlistId: string): Promise<void> {
  assertPlaylistId(playlistId)
  const uri = `spotify:playlist:${playlistId.trim()}`
  try {
    await execFileAsync('playerctl', ['-p', 'spotify', 'open', uri])
    return
  } catch {
    /* fall through */
  }
  try {
    await execFileAsync('xdg-open', [uri])
  } catch {
    throw new Error('No se pudo abrir Spotify (prueba con playerctl o xdg-open).')
  }
}

async function linuxPlayerctl(cmd: 'play' | 'pause'): Promise<void> {
  await execFileAsync('playerctl', ['-p', 'spotify', cmd])
}

async function linuxGetState(): Promise<Omit<SpotifyPlaybackState, 'installed'>> {
  try {
    const { stdout: st } = await execFileAsync('playerctl', ['-p', 'spotify', 'status'])
    const status = st.trim().toLowerCase()
    let playerState: SpotifyPlaybackState['playerState'] = 'unknown'
    if (status === 'playing') playerState = 'playing'
    else if (status === 'paused') playerState = 'paused'
    else if (status === 'stopped') playerState = 'stopped'
    let trackName: string | undefined
    try {
      const { stdout: meta } = await execFileAsync('playerctl', ['-p', 'spotify', 'metadata', 'title'])
      const t = meta.trim()
      if (t) trackName = t
    } catch {
      /* ignore */
    }
    return { appRunning: true, playerState, trackName }
  } catch {
    return { appRunning: false, playerState: 'stopped' }
  }
}

async function linuxSpotifyDesktopInstalled(): Promise<boolean> {
  try {
    await execFileAsync('which', ['spotify'])
    return true
  } catch {
    /* ignore */
  }
  try {
    await execFileAsync('which', ['playerctl'])
    return true
  } catch {
    return false
  }
}

export async function isSpotifyDesktopInstalled(): Promise<boolean> {
  switch (process.platform) {
    case 'darwin':
      return macSpotifyDesktopInstalled()
    case 'win32':
      return winSpotifyDesktopInstalled()
    default:
      return linuxSpotifyDesktopInstalled()
  }
}

export async function playPlaylist(playlistId: string): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return macSpotifyPlayPlaylist(playlistId)
    case 'win32':
      return winPlayPlaylist(playlistId)
    default:
      return linuxPlayPlaylist(playlistId)
  }
}

export async function pausePlayback(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return macSpotifyPause()
    case 'win32':
      return winSendMediaPause()
    default:
      return linuxPlayerctl('pause')
  }
}

export async function resumePlayback(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return macSpotifyPlay()
    case 'win32':
      return winSendMediaPlay()
    default:
      return linuxPlayerctl('play')
  }
}

export async function getPlaybackState(): Promise<SpotifyPlaybackState> {
  const installed = await isSpotifyDesktopInstalled()
  if (!installed) {
    return { installed: false, appRunning: false, playerState: 'stopped' }
  }
  if (process.platform === 'darwin') {
    const inner = await macSpotifyGetState()
    return { installed: true, ...inner }
  }
  if (process.platform === 'win32') {
    const appRunning = await winSpotifyProcessRunning()
    return { installed: true, appRunning, playerState: appRunning ? 'paused' : 'stopped' }
  }
  const inner = await linuxGetState()
  return { installed: true, ...inner }
}
