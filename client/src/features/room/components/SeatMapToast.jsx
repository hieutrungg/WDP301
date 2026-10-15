import { CircleAlert, CircleCheck, History, Info, Undo2, X } from 'lucide-react'

const TONES = {
  success: { icon: CircleCheck, accent: 'bg-secondary', iconClass: 'bg-secondary/15 text-secondary' },
  revert: { icon: Undo2, accent: 'bg-blue-400', iconClass: 'bg-blue-500/15 text-blue-300' },
  info: { icon: Info, accent: 'bg-tertiary', iconClass: 'bg-surface-container-high text-tertiary' },
  error: { icon: CircleAlert, accent: 'bg-primary-container', iconClass: 'bg-primary-container/15 text-primary' },
}

// Rendered through sonner's toast.custom, so it carries its own look instead of the default toast.
function SeatMapToast({ tone = 'success', title, description, chips = [], onClose }) {
  const { icon: Icon, accent, iconClass } = TONES[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="relative flex w-[356px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low py-4 pl-5 pr-4 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold leading-5 text-on-surface">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{description}</p>}
        {chips.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map(({ label, value, icon: ChipIcon = History }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-[11px] text-on-surface-variant">
                <ChipIcon className="size-3" aria-hidden="true" />
                {label}
                <strong className="font-bold text-on-surface">{value}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export default SeatMapToast
