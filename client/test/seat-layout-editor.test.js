import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyTool,
  autoRowLabels,
  createStarterDraft,
  draftFromLayout,
  draftsEqual,
  duplicateRow,
  locateFieldError,
  nextRowLabel,
  resizeDraft,
  seatNumbers,
  summarizeDraft,
  toggleTargetFor,
  toRequestBody,
  updateCells,
  validateDraft,
} from '../src/features/room/utils/seatLayout.js'

test('row labels continue past Z and skip labels in use', () => {
  assert.deepEqual(autoRowLabels(3), ['A', 'B', 'C'])
  assert.equal(autoRowLabels(28)[26], 'AA')
  assert.equal(nextRowLabel(['A', 'B', 'D']), 'C')
})

test('the request body is a full row-major matrix that round-trips', () => {
  let draft = createStarterDraft(2, 3)
  draft = updateCells(draft, [[0, 1]], (cell) => applyTool(cell, 'AISLE'))
  draft = updateCells(draft, [[1, 2]], (cell) => applyTool(cell, 'VIP'))

  const body = toRequestBody(draft)
  assert.equal(body.positions.length, 6)
  assert.deepEqual(
    body.positions.map(({ rowIndex, columnNumber }) => [rowIndex, columnNumber]),
    [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [1, 3]],
  )
  assert.equal(body.positions[1].positionType, 'AISLE')
  assert.equal(body.positions[1].seatType, undefined)

  const positions = body.positions.map((position) => ({ ...position, rowLabel: body.rowLabels[position.rowIndex] }))
  const reloaded = draftFromLayout({ rowLabels: body.rowLabels, columnCount: 3, positions })
  assert.ok(draftsEqual(draft, reloaded))
})

test('summary and seat numbers match the server derivation', () => {
  let draft = createStarterDraft(1, 5)
  draft = updateCells(draft, [[0, 2]], (cell) => applyTool(cell, 'AISLE'))
  draft = updateCells(draft, [[0, 0]], (cell) => applyTool(cell, 'ACCESSIBLE', true))
  draft = updateCells(draft, [[0, 4]], (cell) => applyTool(cell, 'DISABLED', true))
  draft = updateCells(draft, [[0, 3]], (cell) => applyTool(cell, 'DOUBLE_LUXURY'))

  assert.deepEqual(seatNumbers(draft), [[1, 2, null, 3, 4]])
  const summary = summarizeDraft(draft)
  assert.equal(summary.operationalSeatCapacity, 3)
  assert.equal(summary.accessibleCount, 1)
  assert.equal(summary.disabledCount, 1)
  assert.equal(summary.aisleCount, 1)
  assert.equal(summary.standardCount + summary.vipCount + summary.doubleLuxuryCount, 3)
})

test('toggle tools paint one target value across a stroke and skip aisles', () => {
  const draft = createStarterDraft(1, 3)
  const target = toggleTargetFor(draft.cells[0][0], 'ACCESSIBLE')
  const painted = updateCells(draft, [[0, 0], [0, 1]], (cell) => applyTool(cell, 'ACCESSIBLE', target))

  assert.deepEqual(painted.cells[0].map(({ isAccessible }) => isAccessible), [true, true, false])
  const aisle = applyTool({ kind: 'AISLE', seatType: null, status: 'ENABLED', isAccessible: false }, 'ACCESSIBLE', true)
  assert.equal(aisle.isAccessible, false)
})

test('resize keeps existing cells and duplicate inserts a copy with a fresh label', () => {
  let draft = updateCells(createStarterDraft(2, 2), [[1, 1]], (cell) => applyTool(cell, 'VIP'))
  draft = resizeDraft(draft, 3, 4)

  assert.deepEqual(draft.rowLabels, ['A', 'B', 'C'])
  assert.equal(draft.cells[1][1].seatType, 'VIP')
  assert.equal(draft.cells[2][3].seatType, 'STANDARD')

  const duplicated = duplicateRow(draft, 1)
  assert.deepEqual(duplicated.rowLabels, ['A', 'B', 'D', 'C'])
  assert.equal(duplicated.cells[2][1].seatType, 'VIP')
  assert.deepEqual(resizeDraft(draft, 99, 99).cells[0].length, 40)
})

test('validation flags bad and duplicate labels and seatless layouts', () => {
  const draft = { ...createStarterDraft(3, 1), rowLabels: ['A', 'a', '!'] }
  const fields = validateDraft(draft).map(({ field }) => field)
  assert.deepEqual(fields, ['rowLabels.1', 'rowLabels.2'])

  const empty = updateCells(createStarterDraft(1, 1), [[0, 0]], (cell) => applyTool(cell, 'AISLE'))
  assert.deepEqual(validateDraft(empty).map(({ field }) => field), ['positions'])
})

test('server field paths map back to editor cells', () => {
  assert.deepEqual(locateFieldError('positions.7.seatType', 3), { type: 'cell', rowIndex: 2, columnIndex: 1 })
  assert.deepEqual(locateFieldError('rowLabels.4', 3), { type: 'row', rowIndex: 4 })
  assert.equal(locateFieldError('columnCount', 3), null)
})

test('diffDrafts counts changed cells, resized area and relabelled rows', async () => {
  const { diffDrafts } = await import('../src/features/room/utils/seatLayout.js')
  const base = createStarterDraft(2, 3)
  assert.deepEqual(diffDrafts(base, base), { changedCells: 0, rowDelta: 0, columnDelta: 0, labelsChanged: false })

  let edited = updateCells(base, [[0, 0], [1, 2]], (cell) => applyTool(cell, 'VIP'))
  edited = { ...edited, rowLabels: ['A', 'Z'] }
  assert.deepEqual(diffDrafts(base, edited), { changedCells: 2, rowDelta: 0, columnDelta: 0, labelsChanged: true })

  const grown = resizeDraft(base, 3, 3)
  assert.deepEqual(diffDrafts(base, grown), { changedCells: 3, rowDelta: 1, columnDelta: 0, labelsChanged: false })
})
