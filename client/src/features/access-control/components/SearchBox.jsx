import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Debounced search input (CR-09); `value` is the committed query from the URL.
function SearchBox({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (draft.trim() === value) return undefined
    const timer = setTimeout(() => onChangeRef.current(draft.trim()), 300)
    return () => clearTimeout(timer)
  }, [draft, value])

  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
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
  )
}

export default SearchBox
