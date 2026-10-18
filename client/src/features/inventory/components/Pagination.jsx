import { ChevronLeft, ChevronRight } from 'lucide-react'

const pageButton =
  'inline-flex items-center rounded-lg bg-surface-container px-2.5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

function Pagination({ meta, noun, loading, onPageChange }) {
  if (!meta || meta.total === 0) return null

  const first = (meta.page - 1) * meta.limit + 1
  const last = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 px-5 py-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {first}–{last} of {meta.total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1 || loading}
          aria-label="Previous page"
          className={pageButton}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-20 text-center">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages || loading}
          aria-label="Next page"
          className={pageButton}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
