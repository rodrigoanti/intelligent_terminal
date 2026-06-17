import { describe, expect, it } from 'vitest'
import {
  computeTabInsertIndex,
  dropPlaceFromPointer,
  moveItemToIndex,
  swapItemsAtIndices,
} from '../arrayReorder'

describe('moveItemToIndex', () => {
  it('moves forward in the list', () => {
    expect(moveItemToIndex(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves backward in the list', () => {
    expect(moveItemToIndex(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
})

describe('swapItemsAtIndices', () => {
  it('swaps two pane slots without shifting others', () => {
    expect(swapItemsAtIndices(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['d', 'b', 'c', 'a'])
    expect(swapItemsAtIndices(['a', 'b', 'c', 'd'], 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })
})

describe('computeTabInsertIndex', () => {
  const ids = ['t1', 't2', 't3', 't4']

  function reorder(dragId: string, dropId: string, place: 'before' | 'after'): string[] {
    const fromIdx = ids.indexOf(dragId)
    const dropIdx = ids.indexOf(dropId)
    const insertAt = computeTabInsertIndex(ids.length, fromIdx, dropIdx, place)
    return moveItemToIndex(ids, fromIdx, insertAt)
  }

  it('inserts before the drop target', () => {
    expect(reorder('t4', 't2', 'before')).toEqual(['t1', 't4', 't2', 't3'])
  })

  it('inserts after the drop target', () => {
    expect(reorder('t4', 't2', 'after')).toEqual(['t1', 't2', 't4', 't3'])
  })

  it('moves an earlier tab after a later tab', () => {
    expect(reorder('t1', 't3', 'after')).toEqual(['t2', 't3', 't1', 't4'])
  })
})

describe('dropPlaceFromPointer', () => {
  it('chooses before/after from pointer position', () => {
    const rect = { left: 100, width: 200 }
    expect(dropPlaceFromPointer(150, rect)).toBe('before')
    expect(dropPlaceFromPointer(250, rect)).toBe('after')
  })
})
