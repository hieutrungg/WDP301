import { ChevronDown, Plus, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

function BranchToolbar({ query, status, summary, onQueryChange, onStatusChange, onReset, onCreate }) {
  const [draft, setDraft] = useState(query)
  const onQueryChangeRef = useRef(onQueryChange)

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange
  })

  useEffect(() => {
    if (draft.trim() === query) return undefined
    const timer = setTimeout(() => onQueryChangeRef.current(draft.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, query])

  const count = (value) => (summary ? ` (${value})` : '')
  const hasFilters = Boolean(query || status || draft)

  const handleReset = () => {
    setDraft('')
    onReset()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-surface-container-low p-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search branches</span>
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name, address, email or hotline"
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
        <label className="relative">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-11 appearance-none rounded-lg bg-surface-container pl-3 pr-9 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30"
          >
            <option value="">All statuses{count(summary?.total)}</option>
            <option value="ACTIVE">Active{count(summary?.active)}</option>
            <option value="INACTIVE">Inactive{count(summary?.inactive)}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        </label>

        <button
          type="button"
          onClick={handleReset}
          disabled={!hasFilters}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          Reset
        </button>

        <button
          type="button"
          onClick={onCreate}
          className="ml-auto inline-flex h-11 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 lg:ml-0"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Add new branch
        </button>
      </div>
    </div>
  )
}

export default BranchToolbar
