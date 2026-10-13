import { Film } from 'lucide-react'

function EmptyState({ title = 'No movies available', description, action }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-surface-container-low px-6 py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Film className="size-7" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-bold text-on-surface">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState
