// Client-side model of the UC41 seat-map editor. It mirrors the server rules for a live preview;
// the server re-validates everything and its returned summary is authoritative after save.

export const SEAT_TYPES = ['STANDARD', 'VIP', 'DOUBLE_LUXURY']

export const LAYOUT_LIMITS = { maxRows: 30, maxColumns: 40 }

export const ROW_LABEL_PATTERN = /^[A-Z0-9]{1,3}$/

export const SEAT_TYPE_LABELS = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  DOUBLE_LUXURY: 'Double Luxury',
}

export const STARTER_GRID = { rows: 8, columns: 12 }

const seatCell = (seatType = 'STANDARD') => ({
  kind: 'SEAT',
  seatType,
  status: 'ENABLED',
  isAccessible: false,
})

const aisleCell = () => ({ kind: 'AISLE', seatType: null, status: 'ENABLED', isAccessible: false })

// A, B, ... Z, AA, AB, ... in order, skipping labels already used.
const labelAt = (index) => {
  let label = ''
  let value = index + 1
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

export const nextRowLabel = (existing) => {
  const used = new Set(existing)
  for (let index = 0; ; index += 1) {
    const label = labelAt(index)
    if (!used.has(label)) return label
  }
}

export const autoRowLabels = (count) => Array.from({ length: count }, (_, index) => labelAt(index))

export const createStarterDraft = (rows = STARTER_GRID.rows, columns = STARTER_GRID.columns) => ({
  rowLabels: autoRowLabels(rows),
  columnCount: columns,
  cells: Array.from({ length: rows }, () => Array.from({ length: columns }, () => seatCell())),
})

export const normalizeSeatType = (type) => (SEAT_TYPES.includes(type) ? type : 'STANDARD')

export const draftFromLayout = (layout) => {
  const cells = layout.rowLabels.map(() =>
    Array.from({ length: layout.columnCount }, () => aisleCell()),
  )

  for (const position of layout.positions) {
    if (position.positionType !== 'SEAT') continue
    cells[position.rowIndex][position.columnNumber - 1] = {
      kind: 'SEAT',
      seatType: normalizeSeatType(position.seatType),
      status: position.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      isAccessible: Boolean(position.isAccessible),
    }
  }

  return { rowLabels: [...layout.rowLabels], columnCount: layout.columnCount, cells }
}

// Full row-major matrix, so positions[i] maps back to cell (floor(i / cols), i % cols).
export const toRequestBody = (draft) => ({
  rowLabels: draft.rowLabels.map((label) => label.trim().toUpperCase()),
  columnCount: draft.columnCount,
  positions: draft.cells.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) =>
      cell.kind === 'SEAT'
        ? {
            rowIndex,
            columnNumber: columnIndex + 1,
            positionType: 'SEAT',
            seatType: cell.seatType,
            status: cell.status,
            isAccessible: cell.isAccessible,
          }
        : { rowIndex, columnNumber: columnIndex + 1, positionType: 'AISLE', isAccessible: false },
    ),
  ),
})

export const draftsEqual = (a, b) =>
  Boolean(a && b) && JSON.stringify(toRequestBody(a)) === JSON.stringify(toRequestBody(b))

// Same derivation as the server: capacity counts enabled seats; accessibility overlaps tiers.
export const summarizeDraft = (draft) => {
  const summary = {
    rowCount: draft.rowLabels.length,
    columnCount: draft.columnCount,
    totalPositions: draft.rowLabels.length * draft.columnCount,
    seatCount: 0,
    aisleCount: 0,
    standardCount: 0,
    vipCount: 0,
    doubleLuxuryCount: 0,
    accessibleCount: 0,
    disabledCount: 0,
    operationalSeatCapacity: 0,
  }
  const tierKey = { STANDARD: 'standardCount', VIP: 'vipCount', DOUBLE_LUXURY: 'doubleLuxuryCount' }

  for (const row of draft.cells) {
    for (const cell of row) {
      if (cell.kind !== 'SEAT') {
        summary.aisleCount += 1
        continue
      }
      summary.seatCount += 1
      if (cell.status === 'DISABLED') {
        summary.disabledCount += 1
        continue
      }
      summary[tierKey[cell.seatType]] += 1
      summary.operationalSeatCapacity += 1
      if (cell.isAccessible) summary.accessibleCount += 1
    }
  }

  return summary
}

// Seat numbers run 1..n left to right within each row and skip aisles (matches the server).
export const seatNumbers = (draft) =>
  draft.cells.map((row) => {
    let next = 0
    return row.map((cell) => (cell.kind === 'SEAT' ? (next += 1) : null))
  })

export const validateDraft = (draft) => {
  const errors = []
  const seen = new Map()

  draft.rowLabels.forEach((raw, index) => {
    const label = raw.trim().toUpperCase()
    if (!ROW_LABEL_PATTERN.test(label)) {
      errors.push({ field: `rowLabels.${index}`, message: `Row ${index + 1}: use 1-3 letters or digits` })
    } else if (seen.has(label)) {
      errors.push({ field: `rowLabels.${index}`, message: `Row label "${label}" is used more than once` })
    } else {
      seen.set(label, index)
    }
  })

  if (!draft.cells.some((row) => row.some((cell) => cell.kind === 'SEAT'))) {
    errors.push({ field: 'positions', message: 'A layout needs at least one seat' })
  }

  return errors
}

/**
 * Applies an editor tool to one cell. Toggle tools (accessible, disabled) take an explicit
 * target value so a drag paints every cell the same way instead of flipping each one.
 */
export const applyTool = (cell, tool, toggleValue) => {
  switch (tool) {
    case 'AISLE':
      return cell.kind === 'AISLE' ? cell : aisleCell()
    case 'ACCESSIBLE':
      return cell.kind === 'SEAT' && cell.isAccessible !== toggleValue
        ? { ...cell, isAccessible: toggleValue }
        : cell
    case 'DISABLED': {
      const status = toggleValue ? 'DISABLED' : 'ENABLED'
      return cell.kind === 'SEAT' && cell.status !== status ? { ...cell, status } : cell
    }
    default:
      if (!SEAT_TYPES.includes(tool)) return cell
      if (cell.kind === 'AISLE') return seatCell(tool)
      return cell.seatType === tool ? cell : { ...cell, seatType: tool }
  }
}

// Value a toggle tool will paint when a stroke starts on `cell`.
export const toggleTargetFor = (cell, tool) => {
  if (tool === 'ACCESSIBLE') return !cell.isAccessible
  if (tool === 'DISABLED') return cell.status !== 'DISABLED'
  return undefined
}

export const updateCells = (draft, coordinates, update) => {
  let changed = false
  const cells = draft.cells.map((row) => [...row])

  for (const [rowIndex, columnIndex] of coordinates) {
    const current = cells[rowIndex]?.[columnIndex]
    if (!current) continue
    const next = update(current)
    if (next !== current) {
      cells[rowIndex][columnIndex] = next
      changed = true
    }
  }

  return changed ? { ...draft, cells } : draft
}

export const rowCoordinates = (draft, rowIndex) =>
  Array.from({ length: draft.columnCount }, (_, columnIndex) => [rowIndex, columnIndex])

export const columnCoordinates = (draft, columnIndex) =>
  draft.rowLabels.map((_, rowIndex) => [rowIndex, columnIndex])

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Keeps existing cells; new cells start as Standard seats and new rows get the next free label.
export const resizeDraft = (draft, rows, columns) => {
  const rowCount = clamp(rows, 1, LAYOUT_LIMITS.maxRows)
  const columnCount = clamp(columns, 1, LAYOUT_LIMITS.maxColumns)
  const rowLabels = draft.rowLabels.slice(0, rowCount)

  while (rowLabels.length < rowCount) rowLabels.push(nextRowLabel(rowLabels))

  const cells = rowLabels.map((_, rowIndex) =>
    Array.from({ length: columnCount }, (__, columnIndex) => draft.cells[rowIndex]?.[columnIndex] ?? seatCell()),
  )

  return { rowLabels, columnCount, cells }
}

export const duplicateRow = (draft, rowIndex) => {
  if (draft.rowLabels.length >= LAYOUT_LIMITS.maxRows) return draft

  const rowLabels = [...draft.rowLabels]
  rowLabels.splice(rowIndex + 1, 0, nextRowLabel(draft.rowLabels))
  const cells = [...draft.cells]
  cells.splice(rowIndex + 1, 0, draft.cells[rowIndex].map((cell) => ({ ...cell })))

  return { ...draft, rowLabels, cells }
}

export const setRowLabel = (draft, rowIndex, label) => ({
  ...draft,
  rowLabels: draft.rowLabels.map((current, index) => (index === rowIndex ? label : current)),
})

// Maps server field paths ("positions.37.seatType", "rowLabels.2") to editor targets.
export const locateFieldError = (field, columnCount) => {
  const [root, index] = field.split('.')
  const position = Number(index)
  if (!Number.isInteger(position)) return null
  if (root === 'rowLabels') return { type: 'row', rowIndex: position }
  if (root === 'positions' && columnCount > 0) {
    return { type: 'cell', rowIndex: Math.floor(position / columnCount), columnIndex: position % columnCount }
  }
  return null
}

export const describeCell = (draft, rowIndex, columnIndex, numbers) => {
  const cell = draft.cells[rowIndex][columnIndex]
  const rowLabel = draft.rowLabels[rowIndex] || `row ${rowIndex + 1}`

  if (cell.kind !== 'SEAT') return `Row ${rowLabel}, column ${columnIndex + 1}: aisle`

  const parts = [`Seat ${rowLabel}${numbers[rowIndex][columnIndex]}`, SEAT_TYPE_LABELS[cell.seatType]]
  if (cell.isAccessible) parts.push('accessible')
  if (cell.status === 'DISABLED') parts.push('blocked')
  return `${parts.join(', ')} (column ${columnIndex + 1})`
}

// What differs between two drafts, for confirmation dialogs. Cells outside the shared area
// (added/removed rows or columns) count as changed.
export const diffDrafts = (from, to) => {
  const rows = Math.max(from.rowLabels.length, to.rowLabels.length)
  const columns = Math.max(from.columnCount, to.columnCount)
  let changedCells = 0

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = from.cells[row]?.[column]
      const b = to.cells[row]?.[column]
      if (!a || !b || a.kind !== b.kind || a.seatType !== b.seatType || a.status !== b.status || a.isAccessible !== b.isAccessible) {
        changedCells += 1
      }
    }
  }

  const labelsChanged = from.rowLabels.some((label, index) => to.rowLabels[index] !== undefined && to.rowLabels[index] !== label)

  return {
    changedCells,
    rowDelta: to.rowLabels.length - from.rowLabels.length,
    columnDelta: to.columnCount - from.columnCount,
    labelsChanged,
  }
}
