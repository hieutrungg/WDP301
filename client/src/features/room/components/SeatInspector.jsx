import { Accessibility, Armchair, Ban, ChevronRight, Columns3, Copy, Crown, Eraser, Heart, Info, MousePointer2, Rows3 } from 'lucide-react'
import {
  applyTool,
  columnCoordinates,
  duplicateRow,
  LAYOUT_LIMITS,
  rowCoordinates,
  SEAT_TYPE_LABELS,
  updateCells,
} from '../utils/seatLayout'

const KIND_OPTIONS = [
  { id: 'STANDARD', label: 'Standard', icon: Armchair },
  { id: 'VIP', label: 'VIP', icon: Crown },
  { id: 'DOUBLE_LUXURY', label: 'Double Luxury', icon: Heart },
  { id: 'AISLE', label: 'Aisle', icon: Eraser },
]

function Toggle({ label, description, icon: Icon, checked, disabled, onChange }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-xl bg-surface-container p-3 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden="true" />
        <span>
          <span className="block text-sm font-semibold text-on-surface">{label}</span>
          <span className="block text-[11px] text-on-surface-variant">{description}</span>
        </span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-surface-container-highest transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary-container peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-white"
      />
    </label>
  )
}

function BatchButton({ icon: Icon, children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container px-3 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
        {children}
      </span>
      <ChevronRight className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
    </button>
  )
}

function SeatInspector({ draft, numbers, selected, readOnly, onChange }) {
  const cell = selected ? draft.cells[selected.rowIndex]?.[selected.columnIndex] : null

  if (!cell) {
    return (
      <section className="grid gap-3 rounded-2xl border border-white/5 bg-surface-container-low p-5" aria-label="Seat inspector">
        <h2 className="font-heading text-sm font-bold text-on-surface">Seat inspector</h2>
        <p className="flex items-start gap-2.5 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
          <MousePointer2 className="mt-0.5 size-4 shrink-0" />
          Click any position on the map to inspect it. Use the Select tool (V) to inspect without painting.
        </p>
      </section>
    )
  }

  const { rowIndex, columnIndex } = selected
  const rowLabel = draft.rowLabels[rowIndex] || `#${rowIndex + 1}`
  const isSeat = cell.kind === 'SEAT'
  const kind = isSeat ? cell.seatType : 'AISLE'
  const here = [[rowIndex, columnIndex]]
  const apply = (coordinates, tool, toggleValue) =>
    onChange(updateCells(draft, coordinates, (current) => applyTool(current, tool, toggleValue)))
  // Re-tiers the row's existing seats only; its aisles stay aisles.
  const applyTierToRow = (tier) =>
    onChange(
      updateCells(draft, rowCoordinates(draft, rowIndex), (current) =>
        current.kind === 'SEAT' ? applyTool(current, tier) : current,
      ),
    )

  return (
    <section className="grid gap-5 rounded-2xl border border-white/5 bg-surface-container-low p-5" aria-label="Seat inspector">
      <h2 className="font-heading text-sm font-bold text-on-surface">Seat inspector</h2>

      <div className="flex items-center gap-3 rounded-xl border border-primary-container/20 bg-primary-container/5 p-3">
        <span
          className={`grid size-12 shrink-0 place-items-center font-heading text-base font-extrabold ${isSeat ? 'rounded-xl bg-primary-container text-white shadow-crimson' : 'rounded-xl border border-dashed border-white/25 text-on-surface-variant'}`}
        >
          {isSeat ? `${rowLabel}${numbers[rowIndex][columnIndex]}` : '—'}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold text-on-surface">
            {isSeat ? `Seat ${rowLabel}${numbers[rowIndex][columnIndex]} · ${SEAT_TYPE_LABELS[cell.seatType]}` : 'Aisle / blank space'}
          </p>
          <p className="text-xs text-on-surface-variant">
            Row {rowLabel} · Column {columnIndex + 1}
            {isSeat && cell.isAccessible ? ' · Accessible' : ''}
            {isSeat && cell.status === 'DISABLED' ? ' · Blocked' : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Position type</p>
        <div className="grid grid-cols-2 gap-1.5">
          {KIND_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={readOnly}
              aria-pressed={kind === id}
              onClick={() => apply(here, id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${kind === id ? 'bg-primary-container text-white' : 'bg-surface-container text-tertiary hover:bg-surface-container-high hover:text-on-surface'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Toggle
          label="Accessible position"
          description="Marker on this seat; it does not add capacity"
          icon={Accessibility}
          checked={isSeat && cell.isAccessible}
          disabled={readOnly || !isSeat}
          onChange={(value) => apply(here, 'ACCESSIBLE', value)}
        />
        <Toggle
          label="Blocked"
          description="Seat stays on the map but is not sellable"
          icon={Ban}
          checked={isSeat && cell.status === 'DISABLED'}
          disabled={readOnly || !isSeat}
          onChange={(value) => apply(here, 'DISABLED', value)}
        />
      </div>

      <div className="grid gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Row {rowLabel} batch</p>
        <BatchButton icon={Rows3} disabled={readOnly || !isSeat} onClick={() => applyTierToRow(cell.seatType)}>
          {isSeat ? `Apply ${SEAT_TYPE_LABELS[cell.seatType]} to all seats in row ${rowLabel}` : 'Select a seat to apply its tier to the row'}
        </BatchButton>
        <BatchButton icon={Eraser} disabled={readOnly} onClick={() => apply(rowCoordinates(draft, rowIndex), 'AISLE')}>
          Clear row {rowLabel} to aisle
        </BatchButton>
        <BatchButton
          icon={Copy}
          disabled={readOnly || draft.rowLabels.length >= LAYOUT_LIMITS.maxRows}
          onClick={() => onChange(duplicateRow(draft, rowIndex))}
        >
          Duplicate row {rowLabel} below
        </BatchButton>
      </div>

      <div className="grid gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Column {columnIndex + 1} batch</p>
        <BatchButton icon={Columns3} disabled={readOnly} onClick={() => apply(columnCoordinates(draft, columnIndex), 'AISLE')}>
          Make column {columnIndex + 1} a walkway
        </BatchButton>
        <BatchButton icon={Armchair} disabled={readOnly} onClick={() => apply(columnCoordinates(draft, columnIndex), 'STANDARD')}>
          Set column {columnIndex + 1} to Standard seats
        </BatchButton>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-5 text-on-surface-variant">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Saving a structural change creates a new layout version for showtimes created from now on.
        Showtimes created earlier keep the version they were scheduled with.
      </p>
    </section>
  )
}

export default SeatInspector
