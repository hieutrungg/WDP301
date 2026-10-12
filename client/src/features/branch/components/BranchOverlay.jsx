import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

// Shared shell for the edit drawer and the status dialog: Escape/backdrop close, scroll lock.
function BranchOverlay({ variant = 'dialog', title, description, icon: Icon, onClose, busy = false, children }) {
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)

  useEffect(() => {
    onCloseRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && !busyRef.current && onCloseRef.current()
    const previousOverflow = document.body.style.overflow

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm ${isDrawer ? 'flex justify-end' : 'grid place-items-center p-4'}`}
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          isDrawer
            ? 'flex h-full w-full max-w-xl flex-col border-l border-white/5 bg-surface-container-low shadow-[0_20px_40px_rgba(0,0,0,0.7)]'
            : 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-[0_20px_40px_rgba(0,0,0,0.7)]'
        }
      >
        <div
          className={`flex items-start justify-between gap-4 ${isDrawer ? 'border-b border-white/5 px-6 py-5' : 'mb-5'}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-container/15 text-primary">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-bold text-on-surface">{title}</h2>
              {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default BranchOverlay
