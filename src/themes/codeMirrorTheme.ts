import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'
import type { AppTheme } from './presets'

export function createCodeMirrorTheme(theme: AppTheme): Extension {
  const x = theme.xterm
  const muted = theme.vars['--text-muted'] ?? x.brightBlack
  const bg = theme.vars['--bg'] ?? x.background
  const fg = theme.vars['--text'] ?? x.foreground
  const surface = theme.vars['--surface'] ?? bg

  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: x.blue },
    { tag: tags.controlKeyword, color: x.magenta },
    { tag: tags.operator, color: x.foreground },
    { tag: tags.definition(tags.variableName), color: x.cyan },
    { tag: tags.variableName, color: fg },
    { tag: tags.propertyName, color: x.cyan },
    { tag: tags.function(tags.variableName), color: x.cyan },
    { tag: tags.typeName, color: x.yellow },
    { tag: tags.className, color: x.yellow },
    { tag: tags.namespace, color: x.blue },
    { tag: tags.string, color: x.green },
    { tag: tags.special(tags.string), color: x.green },
    { tag: tags.number, color: x.yellow },
    { tag: tags.bool, color: x.magenta },
    { tag: tags.null, color: x.magenta },
    { tag: tags.comment, color: muted, fontStyle: 'italic' },
    { tag: tags.meta, color: muted },
    { tag: tags.regexp, color: x.red },
    { tag: tags.link, color: x.blue, textDecoration: 'underline' },
    { tag: tags.heading, color: x.blue, fontWeight: 'bold' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.invalid, color: x.red },
  ])

  return [
    EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: bg,
        color: fg,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.45',
      },
      '.cm-content': {
        padding: '8px 0',
        caretColor: x.cursor,
      },
      '.cm-gutters': {
        backgroundColor: colorMix(surface, 0.5),
        color: muted,
        border: 'none',
        paddingRight: '4px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: colorMix(surface, 0.8),
      },
      '.cm-activeLine': {
        backgroundColor: colorMix(surface, 0.35),
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: x.cursor,
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: x.selectionBackground,
      },
      '.cm-matchingBracket': {
        backgroundColor: colorMix(x.cyan, 0.2),
        outline: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      },
      '.cm-searchMatch': {
        backgroundColor: colorMix(x.yellow, 0.35),
        outline: `1px solid ${colorMix(x.yellow, 0.55)}`,
      },
      '.cm-searchMatch-selected': {
        backgroundColor: colorMix(x.yellow, 0.55),
        outline: `1px solid ${colorMix(x.yellow, 0.75)}`,
      },
    }, { dark: theme.appearance !== 'light' }),
    syntaxHighlighting(highlightStyle),
  ]
}

function colorMix(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}
