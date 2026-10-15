import { Accessibility, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { describeCell, toggleTargetFor } from '../utils/seatLayout'

const TIER_CLASSES = {
  STANDARD: 'rounded-t-md rounded-b-sm bg-surface-container-high text-tertiary',
  VIP: 'rounded-t-md rounded-b-sm border-t-4 border-secondary bg-secondary/15 text-secondary',
  DOUBLE_LUXURY: 'rounded-full bg-primary-container/25 text-primary ring-1 ring-primary-container/70',
}

const DISABLED_PATTERN =
  'opacity-50 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,0.14)_3px_5px)]'

const cellClasses = (cell, { selected, invalid, editable }) => {
  const classes = [
    'relative grid shrink-0 place-items-center text-[10px] font-semibold leading-none select-none',
    'transition-[transform,filter] duration-75 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
  ]

  if (cell.kind === 'SEAT') {
    classes.push(TIER_CLASSES[cell.seatType])
    if (cell.isAccessible) classes.push('!bg-blue-500/30 !text-blue-100 ring-2 ring-blue-400')
    if (cell.status === 'DISABLED') classes.push(DISABLED_PATTERN)
  } else {
    classes.push('rounded-sm border border-dashed border-white/10')
  }

  if (editable) classes.push('cursor-crosshair hover:brightness-150')
  if (selected) classes.push('z-10 scale-110 outline-2 outline-offset-1 outline-white')
  if (invalid) classes.push('ring-2 !ring-red-500')

  return classes.join(' ')
}

const SeatCell = memo(function SeatCell({
  cell,
  label,
  number,
  rowIndex,
  columnIndex,
  size,
  selected,
  tabbable,
  invalid,
  editable,
  onPointerDown,
  onPointerEnter,
  onKeyboardActivate,
}) {
  const iconSize = Math.max(Math.round(size * 0.5), 10)
  const showNumber = size >= 24 && cell.kind === 'SEAT'

  let content = null
  if (cell.kind === 'SEAT' && cell.status === 'DISABLED') content = <X style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
  else if (cell.kind === 'SEAT' && cell.isAccessible) content = <Accessibility style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
  else if (showNumber) content = number

  return (
    <button
      type="button"
      data-cell={`${rowIndex}-${columnIndex}`}
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      style={{ width: size, height: size }}
      className={cellClasses(cell, { selected, invalid, editable })}
      onPointerDown={(event) => onPointerDown(event, rowIndex, columnIndex)}
      onPointerEnter={(event) => onPointerEnter(event, rowIndex, columnIndex)}
      // `detail === 0` only for keyboard-initiated clicks; pointer input is handled on pointerdown.
      onClick={(event) => event.detail === 0 && onKeyboardActivate(rowIndex, columnIndex)}
    >
      {content}
    </button>
  )
})

const ARROW_MOVES = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

function SeatGrid({ draft, numbers, tool, size, readOnly, selected, invalidCells, onSelect, onPaint }) {
  const gridRef = useRef(null)
  const strokeRef = useRef(null)
  const draftRef = useRef(draft)
  const toolRef = useRef(tool)
  const [focus, setFocus] = useState({ rowIndex: 0, columnIndex: 0 })

  useEffect(() => {
    draftRef.current = draft
    toolRef.current = tool
  })

  useEffect(() => {
    const endStroke = () => {
      strokeRef.current = null
    }
    window.addEventListener('pointerup', endStroke)
    window.addEventListener('pointercancel', endStroke)
    return () => {
      window.removeEventListener('pointerup', endStroke)
      window.removeEventListener('pointercancel', endStroke)
    }
  }, [])

  const activate = useCallback(
    (rowIndex, columnIndex) => {
      setFocus({ rowIndex, columnIndex })
      onSelect(rowIndex, columnIndex)
      if (readOnly || toolRef.current === 'select') return null

      const cell = draftRef.current.cells[rowIndex][columnIndex]
      const toggleValue = toggleTargetFor(cell, toolRef.current)
      onPaint(rowIndex, columnIndex, toggleValue)
      return toggleValue
    },
    [onPaint, onSelect, readOnly],
  )

  const handlePointerDown = useCallback(
    (event, rowIndex, columnIndex) => {
      if (event.button !== 0) return
      const toggleValue = activate(rowIndex, columnIndex)
      if (!readOnly && toolRef.current !== 'select') {
        event.preventDefault()
        strokeRef.current = { toggleValue }
      }
    },
    [activate, readOnly],
  )

  const handlePointerEnter = useCallback(
    (event, rowIndex, columnIndex) => {
      if (!strokeRef.current || (event.buttons & 1) === 0) return
      onPaint(rowIndex, columnIndex, strokeRef.current.toggleValue)
    },
    [onPaint],
  )

  const handleKeyDown = (event) => {
    const move = ARROW_MOVES[event.key]
    if (!move) return
    event.preventDefault()

    const rowIndex = Math.min(Math.max(focus.rowIndex + move[0], 0), draft.rowLabels.length - 1)
    const columnIndex = Math.min(Math.max(focus.columnIndex + move[1], 0), draft.columnCount - 1)
    setFocus({ rowIndex, columnIndex })
    gridRef.current?.querySelector(`[data-cell="${rowIndex}-${columnIndex}"]`)?.focus()
  }

  // Keep the roving tab stop inside the grid after a resize.
  const focusRow = Math.min(focus.rowIndex, draft.rowLabels.length - 1)
  const focusColumn = Math.min(focus.columnIndex, draft.columnCount - 1)
  const gap = size >= 28 ? 6 : 4
  const labelWidth = Math.max(size, 24)

  return (
    <div className="flex w-full flex-col items-center">
      <div className="pointer-events-none mb-6 flex w-full max-w-2xl flex-col items-center" aria-hidden="true">
        <svg viewBox="0 0 600 40" className="h-8 w-full overflow-visible drop-shadow-[0_6px_18px_rgba(229,9,20,0.35)]">
          <defs>
            <linearGradient id="seat-map-screen" x1="0" x2="1">
              <stop offset="0" stopColor="#e50914" stopOpacity="0.2" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#e50914" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M10 34 Q300 0 590 34" fill="none" stroke="url(#seat-map-screen)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="-mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-tertiary">Màn hình / Screen</span>
      </div>

      <div className="w-full overflow-x-auto pb-2">
        <div
          ref={gridRef}
          role="group"
          aria-label={readOnly ? 'Seat map (read only). Use arrow keys to move between positions.' : 'Seat map editor. Use arrow keys to move and Enter to apply the active tool.'}
          onKeyDown={handleKeyDown}
          className={`mx-auto w-max ${!readOnly && tool !== 'select' ? 'touch-none' : ''}`}
          style={{ display: 'grid', gap }}
        >
          <div aria-hidden="true" className="flex items-center" style={{ gap }}>
            <span style={{ width: labelWidth }} />
            {Array.from({ length: draft.columnCount }, (_, columnIndex) => (
              <span
                key={columnIndex}
                style={{ width: size }}
                className="text-center text-[9px] font-semibold text-on-surface-variant/60"
              >
                {columnIndex + 1}
              </span>
            ))}
            <span style={{ width: labelWidth }} />
          </div>

          {draft.cells.map((row, rowIndex) => {
            const rowLabel = draft.rowLabels[rowIndex]
            return (
              <div key={rowIndex} className="flex items-center" style={{ gap }}>
                <span aria-hidden="true" style={{ width: labelWidth }} className="text-right text-xs font-bold text-tertiary">
                  {rowLabel || '?'}
                </span>
                {row.map((cell, columnIndex) => (
                  <SeatCell
                    key={columnIndex}
                    cell={cell}
                    label={describeCell(draft, rowIndex, columnIndex, numbers)}
                    number={numbers[rowIndex][columnIndex]}
                    rowIndex={rowIndex}
                    columnIndex={columnIndex}
                    size={size}
                    selected={selected?.rowIndex === rowIndex && selected?.columnIndex === columnIndex}
                    tabbable={rowIndex === focusRow && columnIndex === focusColumn}
                    invalid={invalidCells.has(`${rowIndex}-${columnIndex}`)}
                    editable={!readOnly && tool !== 'select'}
                    onPointerDown={handlePointerDown}
                    onPointerEnter={handlePointerEnter}
                    onKeyboardActivate={activate}
                  />
                ))}
                <span aria-hidden="true" style={{ width: labelWidth }} className="text-left text-xs font-bold text-tertiary">
                  {rowLabel || '?'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SeatGrid
