import React, { useRef } from 'react'
import { useT } from '@i18n/useT'
import { SplitGutter } from './SplitGutter'
import { useSplitDrag } from '../hooks/useSplitDrag'
import {
  columnGridTemplate,
  DEFAULT_ROW_RATIO,
  rowGridTemplate,
} from '../tabSplitSizes'

/** Normaliza celdas de panel (key = paneId) para reordenar sin desmontar terminales. */
function asPaneCellList(children: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement[]
}

function paneCellWrapperKey(cell: React.ReactElement): React.Key {
  return cell.key ?? 'pane-cell'
}

interface TabTerminalSplitLayoutProps {
  paneCount: 2 | 3 | 4
  columnRatio: number
  rowRatio: number
  resizeEnabled: boolean
  onColumnRatioChange: (ratio: number) => void
  onRowRatioChange: (ratio: number) => void
  onResizeCommit?: () => void
  children: React.ReactNode[]
}

function TwoPaneLayout({
  columnRatio,
  resizeEnabled,
  onColumnRatioChange,
  onResizeCommit,
  children,
}: Omit<TabTerminalSplitLayoutProps, 'paneCount' | 'rowRatio' | 'onRowRatioChange'>): React.ReactElement {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const columnDrag = useSplitDrag({
    axis: 'column',
    enabled: resizeEnabled,
    getContainer: () => containerRef.current,
    onRatioChange: onColumnRatioChange,
    onCommit: onResizeCommit,
  })

  const [left, right] = asPaneCellList(children)
  return (
    <div
      ref={containerRef}
      className="tab-terminal-split tab-terminal-split--panes-2"
      style={{ gridTemplateColumns: columnGridTemplate(columnRatio) }}
    >
      <div key={paneCellWrapperKey(left)} className="tab-terminal-split__cell">{left}</div>
      <SplitGutter
        axis="column"
        ratio={columnRatio}
        enabled={resizeEnabled}
        dragging={columnDrag.dragging}
        ariaLabel={t('split.resizeColumn')}
        onPointerDown={columnDrag.onPointerDown}
      />
      <div key={paneCellWrapperKey(right)} className="tab-terminal-split__cell">{right}</div>
    </div>
  )
}

function ColumnRow({
  columnRatio,
  resizeEnabled,
  getColumnContainer,
  onColumnRatioChange,
  onResizeCommit,
  children,
}: {
  columnRatio: number
  resizeEnabled: boolean
  getColumnContainer: () => HTMLElement | null
  onColumnRatioChange: (ratio: number) => void
  onResizeCommit?: () => void
  children: [React.ReactNode, React.ReactNode]
}): React.ReactElement {
  const { t } = useT()
  const rowRef = useRef<HTMLDivElement>(null)
  const columnDrag = useSplitDrag({
    axis: 'column',
    enabled: resizeEnabled,
    getContainer: () => getColumnContainer() ?? rowRef.current,
    onRatioChange: onColumnRatioChange,
    onCommit: onResizeCommit,
  })

  const [left, right] = asPaneCellList(children)
  return (
    <div
      ref={rowRef}
      className="tab-terminal-split__row"
      style={{ gridTemplateColumns: columnGridTemplate(columnRatio) }}
    >
      <div key={paneCellWrapperKey(left)} className="tab-terminal-split__cell">{left}</div>
      <SplitGutter
        axis="column"
        ratio={columnRatio}
        enabled={resizeEnabled}
        dragging={columnDrag.dragging}
        ariaLabel={t('split.resizeColumn')}
        onPointerDown={columnDrag.onPointerDown}
      />
      <div key={paneCellWrapperKey(right)} className="tab-terminal-split__cell">{right}</div>
    </div>
  )
}

function ThreeOrFourPaneLayout({
  paneCount,
  columnRatio,
  rowRatio,
  resizeEnabled,
  onColumnRatioChange,
  onRowRatioChange,
  onResizeCommit,
  children,
}: TabTerminalSplitLayoutProps): React.ReactElement {
  const { t } = useT()
  const outerRef = useRef<HTMLDivElement>(null)

  const rowDrag = useSplitDrag({
    axis: 'row',
    enabled: resizeEnabled,
    getContainer: () => outerRef.current,
    onRatioChange: onRowRatioChange,
    onCommit: onResizeCommit,
  })

  const paneCells = asPaneCellList(children)

  if (paneCount === 3) {
    const [topLeft, topRight, bottom] = paneCells
    return (
      <div
        ref={outerRef}
        className="tab-terminal-split tab-terminal-split--panes-3"
        style={{ gridTemplateRows: rowGridTemplate(rowRatio) }}
      >
        <ColumnRow
          columnRatio={columnRatio}
          resizeEnabled={resizeEnabled}
          getColumnContainer={() => outerRef.current}
          onColumnRatioChange={onColumnRatioChange}
          onResizeCommit={onResizeCommit}
        >
          {topLeft}
          {topRight}
        </ColumnRow>
        <SplitGutter
          axis="row"
          ratio={rowRatio}
          enabled={resizeEnabled}
          dragging={rowDrag.dragging}
          ariaLabel={t('split.resizeRow')}
          onPointerDown={rowDrag.onPointerDown}
        />
        <div
          key={paneCellWrapperKey(bottom)}
          className="tab-terminal-split__cell tab-terminal-split__cell--full-width"
        >
          {bottom}
        </div>
      </div>
    )
  }

  const [topLeft, topRight, bottomLeft, bottomRight] = paneCells
  return (
    <div
      ref={outerRef}
      className="tab-terminal-split tab-terminal-split--panes-4"
      style={{ gridTemplateRows: rowGridTemplate(rowRatio) }}
    >
      <ColumnRow
        columnRatio={columnRatio}
        resizeEnabled={resizeEnabled}
        getColumnContainer={() => outerRef.current}
        onColumnRatioChange={onColumnRatioChange}
        onResizeCommit={onResizeCommit}
      >
        {topLeft}
        {topRight}
      </ColumnRow>
      <SplitGutter
        axis="row"
        ratio={rowRatio}
        enabled={resizeEnabled}
        dragging={rowDrag.dragging}
        ariaLabel={t('split.resizeRow')}
        onPointerDown={rowDrag.onPointerDown}
      />
      <ColumnRow
        columnRatio={columnRatio}
        resizeEnabled={resizeEnabled}
        getColumnContainer={() => outerRef.current}
        onColumnRatioChange={onColumnRatioChange}
        onResizeCommit={onResizeCommit}
      >
        {bottomLeft}
        {bottomRight}
      </ColumnRow>
    </div>
  )
}

export const TabTerminalSplitLayout: React.FC<TabTerminalSplitLayoutProps> = props => {
  const { paneCount, children } = props
  if (paneCount === 2) {
    return (
      <TwoPaneLayout
        columnRatio={props.columnRatio}
        resizeEnabled={props.resizeEnabled}
        onColumnRatioChange={props.onColumnRatioChange}
        onResizeCommit={props.onResizeCommit}
      >
        {children}
      </TwoPaneLayout>
    )
  }
  return (
    <ThreeOrFourPaneLayout
      {...props}
      rowRatio={props.rowRatio ?? DEFAULT_ROW_RATIO}
    />
  )
}
