import { Minus, Plus, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { autoRowLabels, LAYOUT_LIMITS, resizeDraft, setRowLabel } from '../utils/seatLayout'

const stepButton =
  'grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-on-surface transition-colors hover:bg-surface-bright disabled:pointer-events-none disabled:opacity-35'

// Typed values are committed on blur/Enter, so "12" never passes through a 1-row grid that
// would drop every other row's configuration.
function DimensionInput({ id, label, value, max, disabled, onCommit }) {
  const [text, setText] = useState(String(value))

  const commit = () => {
    const parsed = Number.parseInt(text, 10)
    if (Number.isInteger(parsed) && parsed !== value) onCommit(Math.min(Math.max(parsed, 1), max))
    else setText(String(value))
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label} <span className="font-normal normal-case tracking-normal">(1–{max})</span>
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onCommit(value - 1)} disabled={disabled || value <= 1} aria-label={`Remove one ${label.toLowerCase().replace(/s$/, '')}`} className={stepButton}>
          <Minus className="size-4" />
        </button>
        {/* Plain text + numeric keypad: no native spinner, the −/+ buttons are the steppers. */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          className="h-9 w-full min-w-0 rounded-lg bg-surface-container-high px-2 text-center text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
        />
        <button type="button" onClick={() => onCommit(value + 1)} disabled={disabled || value >= max} aria-label={`Add one ${label.toLowerCase().replace(/s$/, '')}`} className={stepButton}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

function GridSetupPanel({ draft, readOnly, rowErrors, onChange }) {
  const rowCount = draft.rowLabels.length

  return (
    <section className="grid gap-4 rounded-2xl border border-white/5 bg-surface-container-low p-5" aria-label="Grid setup">
      <h2 className="font-heading text-sm font-bold text-on-surface">Grid setup</h2>

      <div className="grid grid-cols-2 gap-3">
        <DimensionInput
          key={`rows-${rowCount}`}
          id="seat-map-rows"
          label="Rows"
          value={rowCount}
          max={LAYOUT_LIMITS.maxRows}
          disabled={readOnly}
          onCommit={(rows) => onChange(resizeDraft(draft, rows, draft.columnCount))}
        />
        <DimensionInput
          key={`columns-${draft.columnCount}`}
          id="seat-map-columns"
          label="Columns"
          value={draft.columnCount}
          max={LAYOUT_LIMITS.maxColumns}
          disabled={readOnly}
          onCommit={(columns) => onChange(resizeDraft(draft, rowCount, columns))}
        />
      </div>
      <p className="-mt-2 text-[11px] text-on-surface-variant">
        Rows and columns are added or removed at the end. New positions start as Standard seats.
      </p>

      <fieldset className="grid gap-2" disabled={readOnly} aria-labelledby="seat-map-row-labels">
        <div className="flex items-center justify-between gap-2">
          <p id="seat-map-row-labels" className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Row identifiers (screen → back)
          </p>
          <button
            type="button"
            onClick={() => onChange({ ...draft, rowLabels: autoRowLabels(rowCount) })}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-40"
          >
            <WandSparkles className="size-3.5" />
            Auto-label
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {draft.rowLabels.map((label, rowIndex) => {
            const error = rowErrors.get(rowIndex)
            return (
              <input
                key={rowIndex}
                value={label}
                maxLength={3}
                aria-label={`Label for row ${rowIndex + 1}`}
                aria-invalid={Boolean(error)}
                title={error}
                onChange={(event) => onChange(setRowLabel(draft, rowIndex, event.target.value.toUpperCase()))}
                className={`h-9 w-full min-w-0 rounded-lg bg-surface-container-high px-1 text-center text-sm font-bold uppercase text-on-surface focus:outline-none focus:ring-2 disabled:opacity-50 ${error ? 'ring-2 ring-red-500 focus:ring-red-500' : 'focus:ring-primary-container'}`}
              />
            )
          })}
        </div>
        {rowErrors.size > 0 && (
          <ul role="alert" className="grid gap-1 text-xs text-on-error-container">
            {[...rowErrors.values()].map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        )}
      </fieldset>
    </section>
  )
}

export default GridSetupPanel
