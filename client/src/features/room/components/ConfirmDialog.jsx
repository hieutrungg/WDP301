import { TriangleAlert, Undo2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

// Custom confirmation modal (replaces window.confirm). Focus starts on the safe action, Tab is
// kept inside the dialog, Escape and the backdrop cancel, and the page behind cannot scroll.
function ConfirmDialog({
  title,
  description,
  details = [],
  confirmLabel,
  cancelLabel = 'Keep editing',
  icon: Icon = Undo2,
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  const danger = tone === 'danger'

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low shadow-[0_24px_48px_rgba(0,0,0,0.75)]"
      >
        <div className={`h-1 ${danger ? 'bg-gradient-to-r from-primary-container via-primary to-primary-container' : 'bg-gradient-to-r from-secondary-container via-secondary to-secondary-container'}`} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${danger ? 'bg-primary-container/15 text-primary shadow-crimson' : 'bg-secondary/10 text-secondary'}`}
            >
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="font-heading text-lg font-bold leading-6 text-on-surface">
                {title}
              </h2>
              <p id="confirm-description" className="mt-1.5 text-sm leading-6 text-on-surface-variant">
                {description}
              </p>
            </div>
          </div>

          {details.length > 0 && (
            <ul className="mt-5 grid gap-2 rounded-xl bg-surface-container p-4">
              {details.map(({ label, value }) => (
                <li key={label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="font-bold text-on-surface">{value}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-on-surface-variant">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-secondary" aria-hidden="true" />
            This cannot be undone. Only the layout already saved on the server is kept.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/5 bg-surface-container-lowest/60 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${danger ? 'bg-primary-container text-white shadow-crimson' : 'bg-secondary-container text-on-secondary-container'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
