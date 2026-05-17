import { SearchQuery } from '@codemirror/search'
import {
  EditorSelection,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view'

const matchMark = Decoration.mark({ class: 'cm-searchMatch' })
const selectedMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

export const setFileSearchQuery = StateEffect.define<SearchQuery>()

const fileSearchField = StateField.define<SearchQuery>({
  create: () => new SearchQuery({ search: '' }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFileSearchQuery)) return effect.value
    }
    return value
  },
})

function buildMatchDecorations(state: EditorState): DecorationSet {
  const query = state.field(fileSearchField)
  if (!query.valid || !query.search) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const cursor = query.getCursor(state, 0, state.doc.length)
  for (const { from, to } of cursor) {
    const selected = state.selection.ranges.some(r => r.from === from && r.to === to)
    builder.add(from, to, selected ? selectedMatchMark : matchMark)
  }
  return builder.finish()
}

const fileSearchHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildMatchDecorations(view.state)
    }

    update(update: import('@codemirror/view').ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.state.field(fileSearchField) !== update.startState.field(fileSearchField)
      ) {
        this.decorations = buildMatchDecorations(update.state)
      }
    }
  },
  { decorations: plugin => plugin.decorations },
)

export function searchQueryFromTerm(term: string): SearchQuery {
  return new SearchQuery({
    search: term,
    caseSensitive: false,
    literal: false,
  })
}

export function countSearchMatches(state: EditorState, query: SearchQuery): number {
  if (!query.valid || !query.search) return 0
  let count = 0
  const cursor = query.getCursor(state, 0, state.doc.length)
  for (const _ of cursor) count++
  return count
}

export function fileFindFirst(view: EditorView): boolean {
  const query = view.state.field(fileSearchField)
  if (!query.valid || !query.search) return false
  const match = query.create().nextMatch(view.state, 0, 0)
  if (!match) return false
  const selection = EditorSelection.single(match.from, match.to)
  view.dispatch({
    selection,
    effects: EditorView.scrollIntoView(selection.main, { y: 'center' }),
    userEvent: 'select.search',
  })
  return true
}

export function fileFindNext(view: EditorView): boolean {
  const query = view.state.field(fileSearchField)
  if (!query.valid || !query.search) return false
  const { to } = view.state.selection.main
  const match = query.create().nextMatch(view.state, to, to)
  if (!match) return false
  const selection = EditorSelection.single(match.from, match.to)
  view.dispatch({
    selection,
    effects: EditorView.scrollIntoView(selection.main, { y: 'center' }),
    userEvent: 'select.search',
  })
  return true
}

export function fileFindPrevious(view: EditorView): boolean {
  const query = view.state.field(fileSearchField)
  if (!query.valid || !query.search) return false
  const { from } = view.state.selection.main
  const match = query.create().prevMatch(view.state, from, from)
  if (!match) return false
  const selection = EditorSelection.single(match.from, match.to)
  view.dispatch({
    selection,
    effects: EditorView.scrollIntoView(selection.main, { y: 'center' }),
    userEvent: 'select.search',
  })
  return true
}

export function fileEditorSearchExtension(): Extension[] {
  return [fileSearchField, fileSearchHighlight]
}
