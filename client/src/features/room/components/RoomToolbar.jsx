import { ChevronDown, Plus, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SORT_OPTIONS } from '../utils/roomOptions'

const SEARCH_DEBOUNCE_MS = 300

const selectClass =
  'h-11 w-full appearance-none rounded-lg bg-surface-container pl-3 pr-9 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30'

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
    </label>
  )
}

function RoomToolbar({ filters, branches, roomTypes, summary, readOnly, onChange, onReset, onCreate }) {
  const [draft, setDraft] = useState(filters.q)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (draft.trim() === filters.q) return undefined
    const timer = setTimeout(() => onChangeRef.current({ q: draft.trim() }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, filters.q])

  const count = (value) => (summary ? ` (${value})` : '')
  const hasFilters = Boolean(filters.q || filters.status || filters.roomType || filters.branchId || filters.sort || draft)

  const handleReset = () => {
    setDraft('')
    onReset()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-surface-container-low p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search rooms</span>
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by room name"
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

        {!readOnly && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Add new room
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <FilterSelect label="Filter by branch" value={filters.branchId} onChange={(branchId) => onChange({ branchId })}>
          <option value="">All branches</option>
          {branches.map(({ id, branchName }) => (
            <option key={id} value={id}>
              {branchName}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Filter by format" value={filters.roomType} onChange={(roomType) => onChange({ roomType })}>
          <option value="">All formats</option>
          {roomTypes.map((roomType) => (
            <option key={roomType} value={roomType}>
              {roomType}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Filter by status" value={filters.status} onChange={(status) => onChange({ status })}>
          <option value="">All statuses{count(summary?.totalRooms)}</option>
          <option value="ACTIVE">Active{count(summary?.active)}</option>
          <option value="MAINTENANCE">Maintenance{count(summary?.maintenance)}</option>
          <option value="INACTIVE">Inactive{count(summary?.inactive)}</option>
        </FilterSelect>

        <FilterSelect label="Sort rooms" value={filters.sort} onChange={(sort) => onChange({ sort })}>
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              Sort: {label}
            </option>
          ))}
        </FilterSelect>

        <button
          type="button"
          onClick={handleReset}
          disabled={!hasFilters}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          Reset
        </button>
      </div>
    </div>
  )
}

export default RoomToolbar
