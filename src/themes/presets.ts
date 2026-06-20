export interface XtermTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface AppTheme {
  id: string
  name: string
  /** Si es `light`, se agrupa en el picker con otros claros */
  appearance?: 'light' | 'dark'
  // Chrome CSS variables (injected as --var: value on :root)
  vars: Record<string, string>
  xterm: XtermTheme
}

export type ThemeTabShape = 'square' | 'point-up' | 'point-down'
export type ThemeVisualCategory = 'regular' | 'glow'

export interface ThemeChromeProfile {
  category: ThemeVisualCategory
  tabShape: ThemeTabShape
  glowMultiplier: number
  panelRadius?: string
}

/** Visual Studio Code — Dark+ */
const vscodeDark: AppTheme = {
  id: 'vscodeDark',
  name: 'VS Code Dark',
  vars: {
    '--bg': '#1e1e1e',
    '--bg-secondary': '#181818',
    '--surface': '#252526',
    '--surface-hover': '#2a2d2e',
    '--border': '#3e3e42',
    '--text': '#cccccc',
    '--text-muted': '#858585',
    '--accent': '#3794ff',
    '--accent-dim': '#264f78',
    '--danger': '#f14c4c',
    '--tab-active-bg': '#1e1e1e',
    '--tab-inactive-bg': '#252526',
    '--scrollbar': '#424242',
    '--radius': '8px',
  },
  xterm: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#aeafad',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f7844',
    selectionForeground: '#cccccc',
    black: '#383838',
    red: '#f14c4c',
    green: '#23d18b',
    yellow: '#cca700',
    blue: '#3794ff',
    magenta: '#bc3fbc',
    cyan: '#29b8db',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#cca700',
    brightBlue: '#3794ff',
    brightMagenta: '#bc3fbc',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
}

/**
 * Atom — Material Dark (ecosistema Atom); el One Dark clásico (#282c34) está en «One Dark».
 */
const atom: AppTheme = {
  id: 'atom',
  name: 'Atom',
  vars: {
    '--bg': '#263238',
    '--bg-secondary': '#1e272c',
    '--surface': '#2e3c43',
    '--surface-hover': '#37474f',
    '--border': '#37474f',
    '--text': '#eeffff',
    '--text-muted': '#546e7a',
    '--accent': '#82aaff',
    '--accent-dim': '#5c7cba',
    '--danger': '#f07178',
    '--tab-active-bg': '#2e3c43',
    '--tab-inactive-bg': '#263238',
    '--scrollbar': '#37474f',
    '--radius': '8px',
  },
  xterm: {
    background: '#263238',
    foreground: '#b2ccd6',
    cursor: '#82aaff',
    cursorAccent: '#263238',
    selectionBackground: '#5c7cba44',
    selectionForeground: '#eeffff',
    black: '#2e3c43',
    red: '#f07178',
    green: '#c3e88d',
    yellow: '#ffcb6b',
    blue: '#82aaff',
    magenta: '#c792ea',
    cyan: '#89ddff',
    white: '#eeffff',
    brightBlack: '#546e7a',
    brightRed: '#f07178',
    brightGreen: '#c3e88d',
    brightYellow: '#ffcb6b',
    brightBlue: '#82aaff',
    brightMagenta: '#c792ea',
    brightCyan: '#89ddff',
    brightWhite: '#ffffff',
  },
}

const dracula: AppTheme = {
  id: 'dracula',
  name: 'Dracula',
  vars: {
    '--bg': '#282a36',
    '--bg-secondary': '#21222c',
    '--surface': '#44475a',
    '--surface-hover': '#6272a4',
    '--border': '#44475a',
    '--text': '#f8f8f2',
    '--text-muted': '#6272a4',
    '--accent': '#bd93f9',
    '--accent-dim': '#9d79f0',
    '--danger': '#ff5555',
    '--tab-active-bg': '#44475a',
    '--tab-inactive-bg': '#282a36',
    '--scrollbar': '#44475a',
    '--radius': '8px',
  },
  xterm: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#bd93f9',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a99',
    selectionForeground: '#f8f8f2',
    black: '#44475a',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#6272a4',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#92a1ff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
}

const nord: AppTheme = {
  id: 'nord',
  name: 'Nord',
  vars: {
    '--bg': '#2e3440',
    '--bg-secondary': '#3b4252',
    '--surface': '#3b4252',
    '--surface-hover': '#434c5e',
    '--border': '#4c566a',
    '--text': '#eceff4',
    '--text-muted': '#9099aa',
    '--accent': '#88c0d0',
    '--accent-dim': '#5e81ac',
    '--danger': '#bf616a',
    '--tab-active-bg': '#3b4252',
    '--tab-inactive-bg': '#2e3440',
    '--scrollbar': '#4c566a',
    '--radius': '8px',
  },
  xterm: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#88c0d0',
    cursorAccent: '#2e3440',
    selectionBackground: '#5e81ac55',
    selectionForeground: '#eceff4',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
}

const gruvbox: AppTheme = {
  id: 'gruvbox',
  name: 'Gruvbox Dark',
  vars: {
    '--bg': '#1d2021',
    '--bg-secondary': '#282828',
    '--surface': '#282828',
    '--surface-hover': '#3c3836',
    '--border': '#504945',
    '--text': '#ebdbb2',
    '--text-muted': '#a89984',
    '--accent': '#d79921',
    '--accent-dim': '#b57614',
    '--danger': '#cc241d',
    '--tab-active-bg': '#282828',
    '--tab-inactive-bg': '#1d2021',
    '--scrollbar': '#504945',
    '--radius': '6px',
  },
  xterm: {
    background: '#1d2021',
    foreground: '#ebdbb2',
    cursor: '#d79921',
    cursorAccent: '#1d2021',
    selectionBackground: '#b5761455',
    selectionForeground: '#ebdbb2',
    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',
    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2',
  },
}

const solarDark: AppTheme = {
  id: 'solarDark',
  name: 'Solarized Dark',
  vars: {
    '--bg': '#002b36',
    '--bg-secondary': '#073642',
    '--surface': '#073642',
    '--surface-hover': '#094555',
    '--border': '#0d5263',
    '--text': '#839496',
    '--text-muted': '#586e75',
    '--accent': '#268bd2',
    '--accent-dim': '#1a6aa3',
    '--danger': '#dc322f',
    '--tab-active-bg': '#073642',
    '--tab-inactive-bg': '#002b36',
    '--scrollbar': '#0d5263',
    '--radius': '8px',
  },
  xterm: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#268bd2',
    cursorAccent: '#002b36',
    selectionBackground: '#1a6aa355',
    selectionForeground: '#eee8d5',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#268bd2',
    brightMagenta: '#6c71c4',
    brightCyan: '#2aa198',
    brightWhite: '#fdf6e3',
  },
}

const monokai: AppTheme = {
  id: 'monokai',
  name: 'Monokai Pro',
  vars: {
    '--bg': '#2d2a2e',
    '--bg-secondary': '#221f22',
    '--surface': '#403e41',
    '--surface-hover': '#4a474b',
    '--border': '#5b595c',
    '--text': '#fcfcfa',
    '--text-muted': '#939293',
    '--accent': '#ffd866',
    '--accent-dim': '#c4a43a',
    '--danger': '#ff6188',
    '--tab-active-bg': '#403e41',
    '--tab-inactive-bg': '#2d2a2e',
    '--scrollbar': '#5b595c',
    '--radius': '6px',
  },
  xterm: {
    background: '#2d2a2e',
    foreground: '#fcfcfa',
    cursor: '#ffd866',
    cursorAccent: '#2d2a2e',
    selectionBackground: '#c4a43a44',
    selectionForeground: '#fcfcfa',
    black: '#403e41',
    red: '#ff6188',
    green: '#a9dc76',
    yellow: '#ffd866',
    blue: '#78dce8',
    magenta: '#ab9df2',
    cyan: '#78dce8',
    white: '#fcfcfa',
    brightBlack: '#727072',
    brightRed: '#ff6188',
    brightGreen: '#a9dc76',
    brightYellow: '#ffd866',
    brightBlue: '#78dce8',
    brightMagenta: '#ab9df2',
    brightCyan: '#78dce8',
    brightWhite: '#fcfcfa',
  },
}

const oneDark: AppTheme = {
  id: 'oneDark',
  name: 'One Dark',
  vars: {
    '--bg': '#282c34',
    '--bg-secondary': '#21252b',
    '--surface': '#2c313a',
    '--surface-hover': '#353b45',
    '--border': '#3e4452',
    '--text': '#abb2bf',
    '--text-muted': '#5c6370',
    '--accent': '#61afef',
    '--accent-dim': '#528bcc',
    '--danger': '#e06c75',
    '--tab-active-bg': '#2c313a',
    '--tab-inactive-bg': '#282c34',
    '--scrollbar': '#3e4452',
    '--radius': '8px',
  },
  xterm: {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#61afef',
    cursorAccent: '#282c34',
    selectionBackground: '#528bcc44',
    selectionForeground: '#abb2bf',
    black: '#2c313a',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
}

const tokyoNight: AppTheme = {
  id: 'tokyoNight',
  name: 'Tokyo Night',
  vars: {
    '--bg': '#1a1b26',
    '--bg-secondary': '#16161e',
    '--surface': '#24283b',
    '--surface-hover': '#2f3549',
    '--border': '#3b4261',
    '--text': '#c0caf5',
    '--text-muted': '#565f89',
    '--accent': '#7aa2f7',
    '--accent-dim': '#3d59a1',
    '--danger': '#f7768e',
    '--tab-active-bg': '#24283b',
    '--tab-inactive-bg': '#1a1b26',
    '--scrollbar': '#3b4261',
    '--radius': '8px',
  },
  xterm: {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#7aa2f7',
    cursorAccent: '#1a1b26',
    selectionBackground: '#3d59a155',
    selectionForeground: '#c0caf5',
    black: '#24283b',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#565f89',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  },
}

const catppuccin: AppTheme = {
  id: 'catppuccin',
  name: 'Catppuccin Mocha',
  vars: {
    '--bg': '#1e1e2e',
    '--bg-secondary': '#181825',
    '--surface': '#313244',
    '--surface-hover': '#45475a',
    '--border': '#45475a',
    '--text': '#cdd6f4',
    '--text-muted': '#a6adc8',
    '--accent': '#cba6f7',
    '--accent-dim': '#7c3aed',
    '--danger': '#f38ba8',
    '--tab-active-bg': '#313244',
    '--tab-inactive-bg': '#1e1e2e',
    '--scrollbar': '#45475a',
    '--radius': '8px',
  },
  xterm: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#cba6f7',
    cursorAccent: '#1e1e2e',
    selectionBackground: '#7c3aed44',
    selectionForeground: '#cdd6f4',
    black: '#313244',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#cba6f7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#f5e0dc',
  },
}

const githubDark: AppTheme = {
  id: 'githubDark',
  name: 'GitHub Dark',
  vars: {
    '--bg': '#0d1117',
    '--bg-secondary': '#161b22',
    '--surface': '#21262d',
    '--surface-hover': '#30363d',
    '--border': '#30363d',
    '--text': '#e6edf3',
    '--text-muted': '#8b949e',
    '--accent': '#58a6ff',
    '--accent-dim': '#1f6feb',
    '--danger': '#f85149',
    '--tab-active-bg': '#21262d',
    '--tab-inactive-bg': '#0d1117',
    '--scrollbar': '#30363d',
    '--radius': '8px',
  },
  xterm: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#1f6feb44',
    selectionForeground: '#e6edf3',
    black: '#21262d',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#c9d1d9',
    brightBlack: '#8b949e',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff',
  },
}

const matrix: AppTheme = {
  id: 'matrix',
  name: 'Matrix',
  vars: {
    '--bg': '#020403',
    '--bg-secondary': '#050a06',
    '--surface': '#0a120c',
    '--surface-hover': '#0f1a12',
    '--border': '#1a3322',
    '--text': '#c8ffc8',
    '--text-muted': '#4a7a55',
    '--accent': '#00ff66',
    '--accent-dim': '#009944',
    '--danger': '#ff4444',
    '--tab-active-bg': '#0a120c',
    '--tab-inactive-bg': '#020403',
    '--scrollbar': '#1a3322',
    '--radius': '8px',
  },
  xterm: {
    background: '#020403',
    foreground: '#86ff9f',
    cursor: '#00ff66',
    cursorAccent: '#020403',
    selectionBackground: '#00ff6628',
    selectionForeground: '#eaffee',
    black: '#071008',
    red: '#6cff85',
    green: '#00ff66',
    yellow: '#c5ff52',
    blue: '#3dff88',
    magenta: '#63ff93',
    cyan: '#52ffc5',
    white: '#c8ffc8',
    brightBlack: '#274130',
    brightRed: '#97ffab',
    brightGreen: '#66ff88',
    brightYellow: '#e6ff85',
    brightBlue: '#74ffa6',
    brightMagenta: '#8bffb3',
    brightCyan: '#83ffe0',
    brightWhite: '#f1fff1',
  },
}

const cyberpunk: AppTheme = {
  id: 'cyberpunk',
  name: 'Cyberpunk 2077',
  vars: {
    '--bg': '#0b0f19',
    '--bg-secondary': '#0f1626',
    '--surface': '#151d2f',
    '--surface-hover': '#1e2840',
    '--border': '#2a3654',
    '--text': '#e6f4ff',
    '--text-muted': '#6d85a8',
    '--accent': '#fcee0a',
    '--accent-dim': '#c9bd00',
    '--danger': '#ff2d6a',
    '--tab-active-bg': '#151d2f',
    '--tab-inactive-bg': '#0b0f19',
    '--scrollbar': '#2a3654',
    '--radius': '8px',
  },
  xterm: {
    background: '#0b0f19',
    foreground: '#d6fbff',
    cursor: '#fcee0a',
    cursorAccent: '#0b0f19',
    selectionBackground: '#ff6ef344',
    selectionForeground: '#fefefe',
    black: '#11182a',
    red: '#ff3b7d',
    green: '#00ff9c',
    yellow: '#fcee0a',
    blue: '#1fb6ff',
    magenta: '#ff6ef3',
    cyan: '#00f6ff',
    white: '#d6fbff',
    brightBlack: '#35507a',
    brightRed: '#ff72a6',
    brightGreen: '#72ffc3',
    brightYellow: '#fff587',
    brightBlue: '#7fd3ff',
    brightMagenta: '#ff9ff7',
    brightCyan: '#7cffff',
    brightWhite: '#ffffff',
  },
}

/** Cyberpunk Neon — más magenta/cian para paneles y chrome, sin tocar la idea base del terminal. */
const cyberpunkNeon: AppTheme = {
  id: 'cyberpunkNeon',
  name: 'Cyberpunk Neon',
  vars: {
    '--bg': '#090814',
    '--bg-secondary': '#0d0b1d',
    '--surface': '#151129',
    '--surface-hover': '#1d1638',
    '--border': '#3a2d68',
    '--text': '#f4ecff',
    '--text-muted': '#9a8fbe',
    '--accent': '#ff4fd8',
    '--accent-dim': '#b83297',
    '--danger': '#ff5a5f',
    '--tab-active-bg': '#1a1331',
    '--tab-inactive-bg': '#090814',
    '--scrollbar': '#3a2d68',
    '--radius': '10px',
  },
  xterm: {
    background: '#090814',
    foreground: '#e9fbff',
    cursor: '#00f0ff',
    cursorAccent: '#090814',
    selectionBackground: '#00f0ff33',
    selectionForeground: '#f7efff',
    black: '#130f25',
    red: '#ff5d73',
    green: '#22ffc1',
    yellow: '#ffe45e',
    blue: '#4fa6ff',
    magenta: '#ff4fd8',
    cyan: '#00f0ff',
    white: '#f7efff',
    brightBlack: '#5a4795',
    brightRed: '#ff91a0',
    brightGreen: '#7cffd8',
    brightYellow: '#fff4a0',
    brightBlue: '#91ccff',
    brightMagenta: '#ff9cf0',
    brightCyan: '#99ffff',
    brightWhite: '#ffffff',
  },
}

/** TRON — rejilla cian sobre negro electrónico */
const tron: AppTheme = {
  id: 'tron',
  name: 'TRON',
  vars: {
    '--bg': '#050508',
    '--bg-secondary': '#0a0c12',
    '--surface': '#0f1218',
    '--surface-hover': '#151a24',
    '--border': '#1e2838',
    '--text': '#dff6ff',
    '--text-muted': '#5a7a9a',
    '--accent': '#00d4ff',
    '--accent-dim': '#0090b8',
    '--danger': '#ff3366',
    '--tab-active-bg': '#0f1218',
    '--tab-inactive-bg': '#050508',
    '--scrollbar': '#1e2838',
    '--radius': '6px',
  },
  xterm: {
    background: '#050508',
    foreground: '#d9f8ff',
    cursor: '#00d4ff',
    cursorAccent: '#050508',
    selectionBackground: '#00d4ff3d',
    selectionForeground: '#f3feff',
    black: '#0b1018',
    red: '#ff4b78',
    green: '#00ffd5',
    yellow: '#fff078',
    blue: '#2f98ff',
    magenta: '#9f89ff',
    cyan: '#00d4ff',
    white: '#dff6ff',
    brightBlack: '#2f4868',
    brightRed: '#ff7b97',
    brightGreen: '#63fff0',
    brightYellow: '#fff7a8',
    brightBlue: '#6dc0ff',
    brightMagenta: '#ccb8ff',
    brightCyan: '#7cffff',
    brightWhite: '#ffffff',
  },
}

/** Blade Runner — neón naranja y teal sobre ciudad nocturna */
const bladeRunner: AppTheme = {
  id: 'bladeRunner',
  name: 'Blade Runner 2049',
  vars: {
    '--bg': '#100c14',
    '--bg-secondary': '#16101c',
    '--surface': '#1c1624',
    '--surface-hover': '#261e30',
    '--border': '#3a3048',
    '--text': '#ebe4f0',
    '--text-muted': '#8a7a9a',
    '--accent': '#ff9f1c',
    '--accent-dim': '#cc7722',
    '--danger': '#ff4d6d',
    '--tab-active-bg': '#1c1624',
    '--tab-inactive-bg': '#100c14',
    '--scrollbar': '#3a3048',
    '--radius': '8px',
  },
  xterm: {
    background: '#100c14',
    foreground: '#f0d8e8',
    cursor: '#2ec4b6',
    cursorAccent: '#100c14',
    selectionBackground: '#ff9f1c33',
    selectionForeground: '#fff8f1',
    black: '#1a1420',
    red: '#ff5a7a',
    green: '#28d1c0',
    yellow: '#ff9f1c',
    blue: '#6a7cff',
    magenta: '#d07cff',
    cyan: '#3de0d3',
    white: '#f0d8e8',
    brightBlack: '#5f4b66',
    brightRed: '#ff86a0',
    brightGreen: '#72f1df',
    brightYellow: '#ffc36b',
    brightBlue: '#9db1ff',
    brightMagenta: '#e8b7ff',
    brightCyan: '#8af7eb',
    brightWhite: '#fff8ff',
  },
}

/** Stranger Things — Mundo del revés (púrpura y rojo) */
const strangerThings: AppTheme = {
  id: 'strangerThings',
  name: 'Stranger Things',
  vars: {
    '--bg': '#12081c',
    '--bg-secondary': '#1a0c28',
    '--surface': '#241236',
    '--surface-hover': '#301848',
    '--border': '#402060',
    '--text': '#e8dcff',
    '--text-muted': '#9070b0',
    '--accent': '#c1121f',
    '--accent-dim': '#8a0e18',
    '--danger': '#ff4444',
    '--tab-active-bg': '#241236',
    '--tab-inactive-bg': '#12081c',
    '--scrollbar': '#402060',
    '--radius': '8px',
  },
  xterm: {
    background: '#12081c',
    foreground: '#eadcff',
    cursor: '#c1121f',
    cursorAccent: '#12081c',
    selectionBackground: '#e01e8440',
    selectionForeground: '#fff4ff',
    black: '#20102f',
    red: '#d11a2b',
    green: '#6d57ff',
    yellow: '#ff9d5c',
    blue: '#4d67ff',
    magenta: '#ff3ba7',
    cyan: '#76dbff',
    white: '#eadcff',
    brightBlack: '#5f4380',
    brightRed: '#ff4a5e',
    brightGreen: '#8c7cff',
    brightYellow: '#ffc27a',
    brightBlue: '#93adff',
    brightMagenta: '#ff7cc6',
    brightCyan: '#a8f0ff',
    brightWhite: '#ffffff',
  },
}

/** Portal — laboratorio Aperture (naranja y azul) */
const portal: AppTheme = {
  id: 'portal',
  name: 'Portal',
  vars: {
    '--bg': '#1a1a1c',
    '--bg-secondary': '#222226',
    '--surface': '#2d2d32',
    '--surface-hover': '#38383e',
    '--border': '#484850',
    '--text': '#ececec',
    '--text-muted': '#909098',
    '--accent': '#ff7a00',
    '--accent-dim': '#cc5a00',
    '--danger': '#e63946',
    '--tab-active-bg': '#2d2d32',
    '--tab-inactive-bg': '#1a1a1c',
    '--scrollbar': '#484850',
    '--radius': '8px',
  },
  xterm: {
    background: '#1a1a1c',
    foreground: '#e0e0e0',
    cursor: '#ff7a00',
    cursorAccent: '#1a1a1c',
    selectionBackground: '#0066ff44',
    selectionForeground: '#ececec',
    black: '#2d2d32',
    red: '#e63946',
    green: '#43aa8b',
    yellow: '#ffbe0b',
    blue: '#0066ff',
    magenta: '#9b5de5',
    cyan: '#00b4d8',
    white: '#ececec',
    brightBlack: '#686870',
    brightRed: '#ff6b6b',
    brightGreen: '#6ee7b7',
    brightYellow: '#ffd166',
    brightBlue: '#4d9fff',
    brightMagenta: '#c77dff',
    brightCyan: '#48cae4',
    brightWhite: '#ffffff',
  },
}

/** Fallout — verde Pip-Boy sobre fondo sepia oscuro */
const fallout: AppTheme = {
  id: 'fallout',
  name: 'Fallout',
  vars: {
    '--bg': '#0f1208',
    '--bg-secondary': '#141808',
    '--surface': '#1c2210',
    '--surface-hover': '#252c14',
    '--border': '#3a4220',
    '--text': '#d4e8a8',
    '--text-muted': '#6a7a40',
    '--accent': '#39ff14',
    '--accent-dim': '#22aa0c',
    '--danger': '#ff6b35',
    '--tab-active-bg': '#1c2210',
    '--tab-inactive-bg': '#0f1208',
    '--scrollbar': '#3a4220',
    '--radius': '6px',
  },
  xterm: {
    background: '#0f1208',
    foreground: '#bfe87a',
    cursor: '#39ff14',
    cursorAccent: '#0f1208',
    selectionBackground: '#39ff1428',
    selectionForeground: '#efffd1',
    black: '#161d0f',
    red: '#ff7c3e',
    green: '#39ff14',
    yellow: '#ffdc39',
    blue: '#6fbf6a',
    magenta: '#9dff8c',
    cyan: '#7affd0',
    white: '#d9f2b0',
    brightBlack: '#53653a',
    brightRed: '#ffa26b',
    brightGreen: '#8fff75',
    brightYellow: '#fff085',
    brightBlue: '#8fd88f',
    brightMagenta: '#c7ffb5',
    brightCyan: '#b7ffe8',
    brightWhite: '#f7ffd8',
  },
}

/** Dune — arena, especia y azul profundo */
const dune: AppTheme = {
  id: 'dune',
  name: 'Dune',
  vars: {
    '--bg': '#14100c',
    '--bg-secondary': '#1a1510',
    '--surface': '#221c16',
    '--surface-hover': '#2e261e',
    '--border': '#403428',
    '--text': '#e8dcc8',
    '--text-muted': '#8a7860',
    '--accent': '#d4893c',
    '--accent-dim': '#a86628',
    '--danger': '#c94c4c',
    '--tab-active-bg': '#221c16',
    '--tab-inactive-bg': '#14100c',
    '--scrollbar': '#403428',
    '--radius': '8px',
  },
  xterm: {
    background: '#14100c',
    foreground: '#ead5ba',
    cursor: '#6ea8fe',
    cursorAccent: '#14100c',
    selectionBackground: '#d4893c36',
    selectionForeground: '#fff5e8',
    black: '#201811',
    red: '#d16652',
    green: '#8ca875',
    yellow: '#d4893c',
    blue: '#79aef8',
    magenta: '#b97ab2',
    cyan: '#69bac9',
    white: '#eadcc8',
    brightBlack: '#645545',
    brightRed: '#ec8c73',
    brightGreen: '#acc696',
    brightYellow: '#efb26e',
    brightBlue: '#9ac9ff',
    brightMagenta: '#ddb0d8',
    brightCyan: '#93d8e8',
    brightWhite: '#fff4e0',
  },
}

/** Star Wars — hangar imperial (rojo y gris metálico) */
const starWars: AppTheme = {
  id: 'starWars',
  name: 'Star Wars',
  vars: {
    '--bg': '#0c0e12',
    '--bg-secondary': '#12151c',
    '--surface': '#1a1e28',
    '--surface-hover': '#242934',
    '--border': '#343b4a',
    '--text': '#e2e6ed',
    '--text-muted': '#7a8494',
    '--accent': '#e63946',
    '--accent-dim': '#a82832',
    '--danger': '#ff4444',
    '--tab-active-bg': '#1a1e28',
    '--tab-inactive-bg': '#0c0e12',
    '--scrollbar': '#343b4a',
    '--radius': '8px',
  },
  xterm: {
    background: '#0c0e12',
    foreground: '#d8dde6',
    cursor: '#ff465a',
    cursorAccent: '#0c0e12',
    selectionBackground: '#e6394633',
    selectionForeground: '#ffffff',
    black: '#171b22',
    red: '#ff465a',
    green: '#62d98f',
    yellow: '#f0c35b',
    blue: '#7aa7ff',
    magenta: '#b48cff',
    cyan: '#72d9ff',
    white: '#e2e6ed',
    brightBlack: '#4a5260',
    brightRed: '#ff7c8a',
    brightGreen: '#98efbc',
    brightYellow: '#f8dd7d',
    brightBlue: '#adc8ff',
    brightMagenta: '#d4bbff',
    brightCyan: '#9be9ff',
    brightWhite: '#ffffff',
  },
}

/** The Witcher — acero, lobo y sangre */
const witcher: AppTheme = {
  id: 'witcher',
  name: 'The Witcher',
  vars: {
    '--bg': '#121618',
    '--bg-secondary': '#181c1f',
    '--surface': '#1e2529',
    '--surface-hover': '#283038',
    '--border': '#384450',
    '--text': '#d8dee4',
    '--text-muted': '#6d7a85',
    '--accent': '#c9a227',
    '--accent-dim': '#8a7018',
    '--danger': '#a41623',
    '--tab-active-bg': '#1e2529',
    '--tab-inactive-bg': '#121618',
    '--scrollbar': '#384450',
    '--radius': '8px',
  },
  xterm: {
    background: '#121618',
    foreground: '#c9d1d9',
    cursor: '#90b0c8',
    cursorAccent: '#121618',
    selectionBackground: '#a4162333',
    selectionForeground: '#f0f4f8',
    black: '#1e2529',
    red: '#a41623',
    green: '#6a994e',
    yellow: '#c9a227',
    blue: '#457b9d',
    magenta: '#9b6b9e',
    cyan: '#89b0c8',
    white: '#d8dee4',
    brightBlack: '#4a5560',
    brightRed: '#e63946',
    brightGreen: '#8bc34a',
    brightYellow: '#e8c547',
    brightBlue: '#6fa8dc',
    brightMagenta: '#c8a2c8',
    brightCyan: '#b0d4e8',
    brightWhite: '#f8fafc',
  },
}

/** Interstellar — vacío estelar, polvo cálido y acento NASA */
const interstellar: AppTheme = {
  id: 'interstellar',
  name: 'Interstellar',
  vars: {
    '--bg': '#05070c',
    '--bg-secondary': '#080b12',
    '--surface': '#0e121c',
    '--surface-hover': '#141a28',
    '--border': '#222a3c',
    '--text': '#c4cedc',
    '--text-muted': '#5a6578',
    '--accent': '#d4a84b',
    '--accent-dim': '#9a7630',
    '--danger': '#e85d4c',
    '--tab-active-bg': '#0e121c',
    '--tab-inactive-bg': '#05070c',
    '--scrollbar': '#222a3c',
    '--radius': '8px',
  },
  xterm: {
    background: '#05070c',
    foreground: '#c8d3e6',
    cursor: '#d4a84b',
    cursorAccent: '#05070c',
    selectionBackground: '#5a8fd444',
    selectionForeground: '#f4f8ff',
    black: '#0b0f17',
    red: '#ef6f5d',
    green: '#82b08f',
    yellow: '#d4a84b',
    blue: '#74a7f2',
    magenta: '#a79ad6',
    cyan: '#7fc8e4',
    white: '#d7dfeb',
    brightBlack: '#3b4558',
    brightRed: '#ff9a8d',
    brightGreen: '#a7d0b1',
    brightYellow: '#edc97e',
    brightBlue: '#a5c4ff',
    brightMagenta: '#cdc0ef',
    brightCyan: '#b1e1f5',
    brightWhite: '#f7fbff',
  },
}

/** Inception — bronce, grafito y niebla de sueños */
const inception: AppTheme = {
  id: 'inception',
  name: 'Inception',
  vars: {
    '--bg': '#141416',
    '--bg-secondary': '#1a1a1d',
    '--surface': '#222226',
    '--surface-hover': '#2c2c32',
    '--border': '#3a3a42',
    '--text': '#d8d6d0',
    '--text-muted': '#7a7880',
    '--accent': '#c9a962',
    '--accent-dim': '#8f7840',
    '--danger': '#c94c4c',
    '--tab-active-bg': '#222226',
    '--tab-inactive-bg': '#141416',
    '--scrollbar': '#3a3a42',
    '--radius': '8px',
  },
  xterm: {
    background: '#141416',
    foreground: '#c8c6c0',
    cursor: '#c9a962',
    cursorAccent: '#141416',
    selectionBackground: '#c9a96233',
    selectionForeground: '#141416',
    black: '#222226',
    red: '#c94c4c',
    green: '#6a9e7a',
    yellow: '#c9a962',
    blue: '#6a8faf',
    magenta: '#9b8b9e',
    cyan: '#7a9eaa',
    white: '#d8d6d0',
    brightBlack: '#5a585e',
    brightRed: '#e07070',
    brightGreen: '#8ab89a',
    brightYellow: '#e0c890',
    brightBlue: '#8aaccc',
    brightMagenta: '#c0b0c8',
    brightCyan: '#a0c4d0',
    brightWhite: '#f0eeea',
  },
}

/** Avatar — bioluminiscencia de Pandora */
const avatar: AppTheme = {
  id: 'avatar',
  name: 'Avatar',
  vars: {
    '--bg': '#050a12',
    '--bg-secondary': '#081018',
    '--surface': '#0c1824',
    '--surface-hover': '#122030',
    '--border': '#1a3048',
    '--text': '#c8e8f0',
    '--text-muted': '#5080a0',
    '--accent': '#48d4e8',
    '--accent-dim': '#2890a8',
    '--danger': '#ff6b8a',
    '--tab-active-bg': '#0c1824',
    '--tab-inactive-bg': '#050a12',
    '--scrollbar': '#1a3048',
    '--radius': '8px',
  },
  xterm: {
    background: '#050a12',
    foreground: '#c5f3ff',
    cursor: '#48d4e8',
    cursorAccent: '#050a12',
    selectionBackground: '#48d4e83a',
    selectionForeground: '#f1fdff',
    black: '#0a1520',
    red: '#ff78a0',
    green: '#5bffaf',
    yellow: '#efe07a',
    blue: '#58a9ff',
    magenta: '#b98cff',
    cyan: '#48d4e8',
    white: '#d6f5ff',
    brightBlack: '#315a7d',
    brightRed: '#ffadc1',
    brightGreen: '#98ffca',
    brightYellow: '#fff0aa',
    brightBlue: '#8ac4ff',
    brightMagenta: '#ddbeff',
    brightCyan: '#9df8ff',
    brightWhite: '#ffffff',
  },
}

/** Jurassic Park — ámbar fósil y selva */
const jurassicPark: AppTheme = {
  id: 'jurassicPark',
  name: 'Jurassic Park',
  vars: {
    '--bg': '#0a100c',
    '--bg-secondary': '#0e1610',
    '--surface': '#142018',
    '--surface-hover': '#1a2c20',
    '--border': '#2a4030',
    '--text': '#d8e8d8',
    '--text-muted': '#5a7860',
    '--accent': '#e8a838',
    '--accent-dim': '#b07820',
    '--danger': '#e63946',
    '--tab-active-bg': '#142018',
    '--tab-inactive-bg': '#0a100c',
    '--scrollbar': '#2a4030',
    '--radius': '8px',
  },
  xterm: {
    background: '#0a100c',
    foreground: '#c0d8c0',
    cursor: '#e8a838',
    cursorAccent: '#0a100c',
    selectionBackground: '#e8a83833',
    selectionForeground: '#0a100c',
    black: '#142018',
    red: '#e63946',
    green: '#2d8a5e',
    yellow: '#e8a838',
    blue: '#3d8ae0',
    magenta: '#a878c0',
    cyan: '#40c0a0',
    white: '#d8e8d8',
    brightBlack: '#406050',
    brightRed: '#ff7080',
    brightGreen: '#4ab878',
    brightYellow: '#f8c860',
    brightBlue: '#68b0ff',
    brightMagenta: '#c8a0e0',
    brightCyan: '#68e8c8',
    brightWhite: '#f0fff0',
  },
}

/** El señor de los anillos — Tierra Media, acero élfico y fuego */
const lordOfTheRings: AppTheme = {
  id: 'lordOfTheRings',
  name: 'El señor de los anillos',
  vars: {
    '--bg': '#0c0e0a',
    '--bg-secondary': '#12140e',
    '--surface': '#1a1c14',
    '--surface-hover': '#24261c',
    '--border': '#343828',
    '--text': '#d8d4c8',
    '--text-muted': '#6a6858',
    '--accent': '#c9a227',
    '--accent-dim': '#887018',
    '--danger': '#b83228',
    '--tab-active-bg': '#1a1c14',
    '--tab-inactive-bg': '#0c0e0a',
    '--scrollbar': '#343828',
    '--radius': '8px',
  },
  xterm: {
    background: '#0c0e0a',
    foreground: '#c8c4b8',
    cursor: '#8ab4c8',
    cursorAccent: '#0c0e0a',
    selectionBackground: '#c9a22733',
    selectionForeground: '#0c0e0a',
    black: '#1a1c14',
    red: '#b83228',
    green: '#5a8a50',
    yellow: '#c9a227',
    blue: '#6a9ec0',
    magenta: '#9a7890',
    cyan: '#7ab0b8',
    white: '#d8d4c8',
    brightBlack: '#505448',
    brightRed: '#e05048',
    brightGreen: '#78b070',
    brightYellow: '#e8c040',
    brightBlue: '#9ac8e8',
    brightMagenta: '#c0a0b8',
    brightCyan: '#a0d0d8',
    brightWhite: '#f0ece0',
  },
}

const solarLight: AppTheme = {
  id: 'solarLight',
  name: 'Solarized Light',
  appearance: 'light',
  vars: {
    '--bg': '#fdf6e3',
    '--bg-secondary': '#eee8d5',
    '--surface': '#eee8d5',
    '--surface-hover': '#e8e2d0',
    '--border': '#d9d3c4',
    '--text': '#586e75',
    '--text-muted': '#93a1a1',
    '--accent': '#268bd2',
    '--accent-dim': '#2075b5',
    '--danger': '#dc322f',
    '--tab-active-bg': '#eee8d5',
    '--tab-inactive-bg': '#fdf6e3',
    '--scrollbar': '#d9d3c4',
    '--radius': '8px',
  },
  xterm: {
    background: '#fdf6e3',
    foreground: '#586e75',
    cursor: '#268bd2',
    cursorAccent: '#fdf6e3',
    selectionBackground: '#268bd233',
    selectionForeground: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#268bd2',
    brightMagenta: '#6c71c4',
    brightCyan: '#2aa198',
    brightWhite: '#002b36',
  },
}

const githubLight: AppTheme = {
  id: 'githubLight',
  name: 'GitHub Light',
  appearance: 'light',
  vars: {
    '--bg': '#ffffff',
    '--bg-secondary': '#f6f8fa',
    '--surface': '#f6f8fa',
    '--surface-hover': '#eaeef2',
    '--border': '#d0d7de',
    '--text': '#24292f',
    '--text-muted': '#57606a',
    '--accent': '#0969da',
    '--accent-dim': '#0550ae',
    '--danger': '#cf222e',
    '--tab-active-bg': '#f6f8fa',
    '--tab-inactive-bg': '#ffffff',
    '--scrollbar': '#d0d7de',
    '--radius': '8px',
  },
  xterm: {
    background: '#ffffff',
    foreground: '#24292f',
    cursor: '#0969da',
    cursorAccent: '#ffffff',
    selectionBackground: '#0969da33',
    selectionForeground: '#24292f',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#9a6700',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#055d20',
    brightYellow: '#bf8700',
    brightBlue: '#0550ae',
    brightMagenta: '#622cbc',
    brightCyan: '#116329',
    brightWhite: '#24292f',
  },
}

export const THEMES: AppTheme[] = [
  vscodeDark,
  atom,
  dracula,
  nord,
  gruvbox,
  solarDark,
  monokai,
  oneDark,
  tokyoNight,
  catppuccin,
  githubDark,
  matrix,
  interstellar,
  cyberpunk,
  cyberpunkNeon,
  tron,
  bladeRunner,
  strangerThings,
  portal,
  fallout,
  dune,
  starWars,
  witcher,
  inception,
  avatar,
  jurassicPark,
  lordOfTheRings,
  solarLight,
  githubLight,
]

export function getTheme(id: string): AppTheme {
  return THEMES.find(t => t.id === id) ?? vscodeDark
}

const THEME_CHROME_PROFILES: Record<string, ThemeChromeProfile> = {
  vscodeDark: { category: 'regular', tabShape: 'square', glowMultiplier: 0.9, panelRadius: '8px' },
  atom: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  dracula: { category: 'regular', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '12px' },
  nord: { category: 'regular', tabShape: 'square', glowMultiplier: 0.95, panelRadius: '10px' },
  gruvbox: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '8px' },
  solarDark: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  monokai: { category: 'regular', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '12px' },
  oneDark: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  tokyoNight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.35, panelRadius: '10px' },
  catppuccin: { category: 'regular', tabShape: 'square', glowMultiplier: 1.08, panelRadius: '14px' },
  githubDark: { category: 'regular', tabShape: 'square', glowMultiplier: 0.92, panelRadius: '8px' },
  matrix: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '8px' },
  interstellar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.28, panelRadius: '10px' },
  cyberpunk: { category: 'glow', tabShape: 'square', glowMultiplier: 1.95, panelRadius: '10px' },
  cyberpunkNeon: { category: 'glow', tabShape: 'square', glowMultiplier: 2.25, panelRadius: '12px' },
  tron: { category: 'glow', tabShape: 'square', glowMultiplier: 2.0, panelRadius: '8px' },
  bladeRunner: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '10px' },
  strangerThings: { category: 'glow', tabShape: 'square', glowMultiplier: 1.8, panelRadius: '12px' },
  portal: { category: 'regular', tabShape: 'square', glowMultiplier: 1.08, panelRadius: '10px' },
  fallout: { category: 'glow', tabShape: 'square', glowMultiplier: 1.55, panelRadius: '8px' },
  dune: { category: 'regular', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '10px' },
  starWars: { category: 'glow', tabShape: 'square', glowMultiplier: 1.45, panelRadius: '8px' },
  witcher: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '8px' },
  inception: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  avatar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.6, panelRadius: '14px' },
  jurassicPark: { category: 'regular', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '8px' },
  lordOfTheRings: { category: 'regular', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '8px' },
  solarLight: { category: 'regular', tabShape: 'square', glowMultiplier: 0.95, panelRadius: '10px' },
  githubLight: { category: 'regular', tabShape: 'square', glowMultiplier: 0.88, panelRadius: '8px' },
}

export function getThemeChromeProfile(theme: AppTheme | string): ThemeChromeProfile {
  const id = typeof theme === 'string' ? theme : theme.id
  return THEME_CHROME_PROFILES[id] ?? {
    category: 'regular',
    tabShape: 'square',
    glowMultiplier: 1,
    panelRadius: '10px',
  }
}

/** Normaliza `themeId` persistido si apunta a un tema ya eliminado. */
export function normalizeThemeId(id: string): string {
  return THEMES.some(t => t.id === id) ? id : vscodeDark.id
}

function isLightTheme(t: AppTheme): boolean {
  return t.appearance === 'light'
}

/**
 * Temas del picker: oscuros primero y claros después
 * (separador visual entre grupos en el modal).
 */
export function getThemesForPicker(): AppTheme[] {
  const dark = THEMES.filter(t => !isLightTheme(t))
  const light = THEMES.filter(t => isLightTheme(t))
  return [...dark, ...light]
}

/** RGB 0–255 desde `#rgb` o `#rrggbb`; `null` si no es hex válido. */
function parseHexAccent(s: string): [number, number, number] | null {
  const t = s.trim()
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function scaledAlpha(base: number, multiplier: number, max = 0.55): number {
  return Math.min(max, Number((base * multiplier).toFixed(3)))
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number): number => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(lumA: number, lumB: number): number {
  const hi = Math.max(lumA, lumB)
  const lo = Math.min(lumA, lumB)
  return (hi + 0.05) / (lo + 0.05)
}

const ACCENT_FG_CANDIDATES: ReadonlyArray<[[number, number, number], string]> = [
  [[255, 255, 255], '#f7f7fc'],
  [[12, 12, 14], '#0c0c0e'],
]

/**
 * Color de texto legible sobre `--accent` (WCAG: elige blanco u oscuro con mayor ratio de contraste).
 */
function accentForegroundFor(accentCss: string): string {
  const rgb = parseHexAccent(accentCss)
  if (!rgb) return '#f7f7fc'
  const L = relativeLuminance(rgb)
  let best = '#f7f7fc'
  let bestRatio = 0
  for (const [candRgb, hex] of ACCENT_FG_CANDIDATES) {
    const r = contrastRatio(L, relativeLuminance(candRgb))
    if (r > bestRatio) {
      bestRatio = r
      best = hex
    }
  }
  return best
}

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement
  const chrome = getThemeChromeProfile(theme)
  root.dataset.theme = theme.id
  root.dataset.themeCategory = chrome.category
  root.dataset.tabShape = chrome.tabShape
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
  root.style.setProperty('--panel-radius', chrome.panelRadius ?? theme.vars['--radius'] ?? '8px')

  const accent = theme.vars['--accent'] ?? theme.xterm.cursor
  root.style.setProperty('--accent-fg', accentForegroundFor(accent))

  const accentRgb = parseHexAccent(accent)
  if (accentRgb) {
    const glow = chrome.glowMultiplier
    root.style.setProperty('--accent-rgb', `${accentRgb[0]} ${accentRgb[1]} ${accentRgb[2]}`)
    root.style.setProperty('--accent-veil', rgba(accentRgb, scaledAlpha(0.08, glow, 0.28)))
    root.style.setProperty('--accent-veil-strong', rgba(accentRgb, scaledAlpha(0.14, glow, 0.34)))
    root.style.setProperty('--accent-glow-soft', rgba(accentRgb, scaledAlpha(0.12, glow, 0.3)))
    root.style.setProperty('--accent-glow', rgba(accentRgb, scaledAlpha(0.18, glow, 0.42)))
    root.style.setProperty('--accent-glow-strong', rgba(accentRgb, scaledAlpha(0.3, glow, 0.58)))
    root.style.setProperty('--accent-border-soft', rgba(accentRgb, scaledAlpha(0.24, glow, 0.42)))
    root.style.setProperty('--accent-border-strong', rgba(accentRgb, scaledAlpha(0.52, glow, 0.68)))
  }
}
