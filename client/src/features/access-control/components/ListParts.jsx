import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getStaffStatusMeta } from '../utils/accessControl'

export const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

export const primaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

const toneClass = {
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-400/15 text-amber-200',
  muted: 'bg-surface-container-highest text-on-surface-variant',
}

export function StatusBadge({ status }) {
  const meta = getStaffStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${toneClass[meta.tone]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

export function RoleChip({ name, isSystem }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${isSystem ? 'bg-primary-container/15 text-primary' : 'bg-secondary/10 text-secondary'}`}
    >
      {name}
    </span>
  )
}

export function ListMessage({ icon: Icon, title, body, action }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-heading text-lg font-bold text-on-surface">{title}</p>
      <p className="mt-1 max-w-md text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ListSkeleton({ label, columns = 5 }) {
  return (
    <ul aria-busy="true" aria-label={label}>
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="grid gap-3 border-t border-white/5 px-5 py-5 first:border-t-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (__, cell) => (
            <span key={cell} className="h-4 animate-pulse rounded bg-surface-container-high" />
          ))}
        </li>
      ))}
    </ul>
  )
}

// CR-08 pagination footer.
export function ListPagination({ meta, noun, pluralNoun, busy, onPageChange }) {
  if (!meta || meta.total === 0) return null

  const firstItem = (meta.page - 1) * meta.limit + 1
  const lastItem = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 px-5 py-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {firstItem}–{lastItem} of {meta.total} {meta.total === 1 ? noun : pluralNoun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1 || busy}
          aria-label="Previous page"
          className={`${secondaryButton} px-2.5 py-2`}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-20 text-center">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages || busy}
          aria-label="Next page"
          className={`${secondaryButton} px-2.5 py-2`}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function SortHeader({ label, field, sort, order, onSort }) {
  const active = sort === field
  return (
    <button
      type="button"
      onClick={() => onSort(field, active && order === 'asc' ? 'desc' : 'asc')}
      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${active ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span aria-hidden="true">{active ? (order === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  )
}
