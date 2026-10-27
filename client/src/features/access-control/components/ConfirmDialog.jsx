import { TriangleAlert } from 'lucide-react'
import AdminOverlay from './AdminOverlay'

// CR-05 confirmation step. `tone="danger"` for disabling an account or saving a role without
// access rights.
function ConfirmDialog({
  title,
  description,
  points = [],
  confirmLabel = 'Confirm',
  tone = 'danger',
  icon = TriangleAlert,
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  return (
    <AdminOverlay icon={icon} title={title} description={description} onClose={onCancel} busy={busy} layer={80}>
      <div className="space-y-5">
        {points.length > 0 && (
          <ul className="space-y-2 text-sm text-on-surface-variant">
            {points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-on-surface-variant/60" />
                {point}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-container/40 p-3 text-sm text-on-error-container">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 ${tone === 'danger' ? 'bg-primary-container text-white shadow-crimson' : 'bg-secondary-container text-on-secondary-container'}`}
          >
            {busy ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </AdminOverlay>
  )
}

export default ConfirmDialog
