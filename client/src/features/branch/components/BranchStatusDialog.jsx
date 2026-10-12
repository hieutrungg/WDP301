import { Ban, CalendarClock, Power, PowerOff, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { changeBranchStatusRequest } from '../api/branchApi'
import { getApiErrorCode } from '../utils/branchFormat'
import BranchOverlay from './BranchOverlay'

const REFRESH_CODES = new Set(['BRANCH_STATUS_CONFLICT', 'BRANCH_NOT_FOUND'])

function BlockedContent({ branch, message, onClose }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary-container/30 bg-primary-container/10 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Target branch</p>
        <p className="mt-1 font-heading text-lg font-bold text-on-surface">{branch.branchName}</p>
        <p className="mt-1 text-xs text-secondary">Status remains Active</p>
      </div>

      <p className="flex items-start gap-3 rounded-lg bg-error-container/30 p-3 text-sm text-on-error-container">
        <CalendarClock className="mt-0.5 size-5 shrink-0" />
        {message}
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Acknowledge and return
        </button>
      </div>
    </div>
  )
}

function BranchStatusDialog({ branch, onClose, onChanged }) {
  const [submitting, setSubmitting] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const disabling = branch.status === 'ACTIVE'
  const nextStatus = disabling ? 'INACTIVE' : 'ACTIVE'

  const handleConfirm = async () => {
    setSubmitting(true)
    setServerError('')

    try {
      const updated = await changeBranchStatusRequest(branch.id, nextStatus)
      toast.success(disabling ? 'Branch disabled' : 'Branch enabled', {
        description: disabling
          ? `${updated.branchName} is hidden from customers.`
          : `${updated.branchName} is visible to customers again.`,
      })
      onChanged()
    } catch (error) {
      const code = getApiErrorCode(error)

      if (code === 'BRANCH_HAS_FUTURE_SHOWTIMES') {
        setBlockedMessage(getApiErrorMessage(error))
      } else if (REFRESH_CODES.has(code)) {
        toast.error(getApiErrorMessage(error))
        onChanged()
      } else {
        setServerError(getApiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (blockedMessage) {
    return (
      <BranchOverlay icon={Ban} title="Action blocked" description="Active showtime dependencies" onClose={onClose}>
        <BlockedContent branch={branch} message={blockedMessage} onClose={onClose} />
      </BranchOverlay>
    )
  }

  return (
    <BranchOverlay
      icon={disabling ? PowerOff : Power}
      title={disabling ? 'Disable this branch?' : 'Enable this branch?'}
      description={branch.branchName}
      onClose={onClose}
      busy={submitting}
    >
      <div className="space-y-5">
        <ul className="space-y-2 text-sm text-on-surface-variant">
          {(disabling
            ? [
                'The branch is hidden from public discovery.',
                'It cannot receive new showtimes while inactive.',
                'Rooms, showtime history and transactions are kept. Nothing is deleted.',
              ]
            : [
                'The branch appears in public discovery again.',
                'Managers can schedule new showtimes for its active rooms.',
              ]
          ).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-on-surface-variant/60" />
              {item}
            </li>
          ))}
        </ul>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-container/40 p-3 text-sm text-on-error-container">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 ${disabling ? 'bg-primary-container text-white shadow-crimson' : 'bg-secondary-container text-on-secondary-container'}`}
          >
            {submitting ? 'Saving...' : disabling ? 'Disable branch' : 'Enable branch'}
          </button>
        </div>
      </div>
    </BranchOverlay>
  )
}

export default BranchStatusDialog
