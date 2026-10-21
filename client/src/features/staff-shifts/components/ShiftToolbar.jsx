import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  SHIFT_STATUS_META,
  SHIFT_STATUS_OPTIONS,
  addDays,
  formatDateLabel,
  isValidLocalDate,
} from '../utils/staffShiftFormat'

const SEARCH_DEBOUNCE_MS = 300

const selectClass =
  'h-11 appearance-none rounded-lg bg-surface-container pl-3 pr-9 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30'

const iconButton =
  'grid size-11 place-items-center rounded-lg bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
    </label>
  )
}

// UC38 step 3: filter by past shift date and employee name, plus status and work position.
function ShiftToolbar({ filters, today, stations, onChange, onReset }) {
  const { q, date, status, station } = filters
  const [draft, setDraft] = useState(q)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (draft.trim() === q) return undefined
    const timer = setTimeout(() => onChangeRef.current({ q: draft.trim() }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, q])

  const hasFilters = Boolean(q || status || station || draft || date !== today)

  const handleReset = () => {
    setDraft('')
    onReset()
  }

  const handleDateInput = (event) => {
    if (isValidLocalDate(event.target.value)) onChange({ date: event.target.value })
  }

  // A position chosen earlier stays selectable even if no longer listed.
  const positionOptions = station && !(stations ?? []).includes(station) ? [...(stations ?? []), station] : (stations ?? [])

  return (
    <div className="space-y-3 rounded-2xl border border-white/5 bg-surface-container-low p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange({ date: addDays(date, -1) })} aria-label="Previous day" className={iconButton}>
          <ChevronLeft className="size-4" />
        </button>
        <label className="relative">
          <span className="sr-only">Shift date</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
          <input
            type="date"
            value={date}
            onChange={handleDateInput}
            className="h-11 rounded-lg bg-surface-container pl-10 pr-3 text-sm text-on-surface outline-none [color-scheme:dark] focus:ring-2 focus:ring-primary-container/30"
          />
        </label>
        <button type="button" onClick={() => onChange({ date: addDays(date, 1) })} aria-label="Next day" className={iconButton}>
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange({ date: today })}
          disabled={date === today}
          className="h-11 rounded-lg bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40"
        >
          Today
        </button>
        <p className="ml-1 text-sm font-semibold text-on-surface">{formatDateLabel(date)}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search by employee name</span>
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by employee name"
            maxLength={100}
            className="h-11 w-full rounded-lg border border-transparent bg-surface-container pl-10 pr-10 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/60 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <SelectField label="Filter by status" value={status} onChange={(value) => onChange({ status: value })}>
            <option value="">All statuses</option>
            {SHIFT_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {SHIFT_STATUS_META[value].label}
              </option>
            ))}
          </SelectField>

          <SelectField label="Filter by work position" value={station} onChange={(value) => onChange({ station: value })}>
            <option value="">All positions</option>
            {positionOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <button
            type="button"
            onClick={handleReset}
            disabled={!hasFilters}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShiftToolbar
