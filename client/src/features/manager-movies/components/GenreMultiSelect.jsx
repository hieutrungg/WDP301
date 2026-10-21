import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { MOVIE_GENRES } from '../data/genres'

export default function GenreMultiSelect({
  id = 'genres', value = [], onChange, options = MOVIE_GENRES, disabled = false,
  invalid = false, describedBy,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(null)
  const selected = [...new Set(value)]
  const filtered = [...new Set(options)].filter((genre) =>
    genre.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const activeIndex = Math.max(0, filtered.indexOf(active))
  const expanded = open && !disabled
  const activeId = expanded && filtered.length ? `${listId}-${activeIndex}` : undefined

  useEffect(() => {
    if (!expanded) return
    const dismiss = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [expanded])

  useEffect(() => {
    if (!activeId) return
    const list = listRef.current
    const option = document.getElementById(activeId)
    if (!list || !option) return
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
  }, [activeId])

  function select(genre) {
    if (disabled) return
    if (!selected.includes(genre)) onChange([...selected, genre])
    setSearch('')
    setActive(genre)
    inputRef.current?.focus()
    setOpen(true)
  }

  function remove(genre) {
    onChange(selected.filter((item) => item !== genre))
    inputRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (disabled || event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const next = expanded ? activeIndex + direction : direction > 0 ? 0 : filtered.length - 1
      if (filtered.length) setActive(filtered[(next + filtered.length) % filtered.length])
    } else if (event.key === 'Enter') {
      // Search text must never submit the form or become a new genre.
      event.preventDefault()
      if (expanded && filtered.length) select(filtered[activeIndex])
      else setOpen(true)
    } else if (event.key === 'Backspace' && !search && selected.length) {
      event.preventDefault()
      onChange(selected.slice(0, -1))
    }
  }

  return (
    <div ref={rootRef} className="relative mt-2 min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setSearch('')
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          setSearch('')
        }
      }}>
      <div className={`flex min-h-11 min-w-0 flex-wrap items-center gap-1.5 rounded-lg border bg-surface-container-lowest py-2 pl-3 pr-9 text-sm transition-colors focus-within:border-primary ${invalid ? 'border-red-400' : 'border-white/10'} ${disabled ? 'opacity-60' : ''}`}
        onClick={(event) => {
          if (!disabled && !event.target.closest('button')) {
            inputRef.current?.focus()
            setOpen(true)
          }
        }}>
        {selected.map((genre) => (
          <span key={genre} className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <span className="break-words">{genre}</span>
            <button type="button" disabled={disabled} aria-label={`Remove ${genre}`}
              onClick={() => remove(genre)}
              className="shrink-0 rounded p-0.5 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed">
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input ref={inputRef} id={id} type="text" role="combobox" autoComplete="off"
          value={search} disabled={disabled} aria-expanded={expanded} aria-controls={listId}
          aria-autocomplete="list" aria-haspopup="listbox" aria-required="true"
          aria-invalid={invalid} aria-describedby={describedBy} aria-activedescendant={activeId}
          placeholder={selected.length ? 'Add genre…' : 'Select genres…'}
          onFocus={() => { if (!disabled) setOpen(true) }}
          onChange={(event) => { setSearch(event.target.value); setActive(null); setOpen(true) }}
          onKeyDown={handleKeyDown}
          className="min-w-12 flex-1 bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed" />
        <button type="button" disabled={disabled} aria-label={expanded ? 'Close genre list' : 'Open genre list'}
          aria-expanded={expanded} aria-controls={listId}
          onClick={() => { inputRef.current?.focus(); setOpen(!expanded) }}
          className="absolute right-2 top-2.5 rounded p-1 text-on-surface-variant hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed">
          <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-surface-container shadow-lg shadow-black/30">
          <ul ref={listRef} id={listId} role="listbox" aria-label="Available film genres" aria-multiselectable="true"
            className="relative max-h-60 overflow-y-auto overscroll-contain p-1">
            {filtered.map((genre, index) => (
              <li key={genre} id={`${listId}-${index}`} role="option" aria-selected={selected.includes(genre)}
                onPointerMove={() => setActive(genre)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(genre)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${index === activeIndex ? 'bg-primary/15 text-primary' : selected.includes(genre) ? 'text-primary' : 'text-on-surface hover:bg-primary/10 hover:text-primary'}`}>
                {genre}{selected.includes(genre) && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {!filtered.length && <p role="status" className="px-4 py-3 text-sm text-on-surface-variant">No genres match your search.</p>}
        </div>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {selected.length ? `Selected genres: ${selected.join(', ')}.` : 'No genres selected.'}
      </span>
    </div>
  )
}
