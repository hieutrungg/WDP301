import { Ban, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { deleteRoomRequest } from '../api/roomApi'
import { useRoomDetail } from '../hooks/useRooms'
import { getApiErrorCode, pluralize } from '../utils/roomFormat'
import RoomOverlay from './RoomOverlay'

const REFRESH_CODES = new Set(['ROOM_NOT_FOUND'])

const secondaryButton =
  'rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50'

// The server decides whether a room can be deleted (it never hosted a showtime); the dialog reads
// that up front so the Manager is not asked to confirm something that will be refused.
function RoomDeleteDialog({ room, onClose, onDeleted, onRetire }) {
  const [reloadToken, setReloadToken] = useState(0)
  const detail = useRoomDetail(room.id, reloadToken)
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const info = detail.data?.id === room.id && !detail.loading ? detail.data : null
  const matches = confirmation.trim().toLowerCase() === room.roomName.trim().toLowerCase()

  const handleDelete = async () => {
    setSubmitting(true)
    setServerError('')

    try {
      await deleteRoomRequest(room.id)
      toast.success('Room deleted', { description: `${room.roomName} was removed.` })
      onDeleted()
    } catch (error) {
      const code = getApiErrorCode(error)

      if (code === 'ROOM_HAS_SHOWTIME_HISTORY') {
        // A showtime appeared since the dialog loaded; show the blocked state instead.
        setReloadToken((token) => token + 1)
        setServerError(getApiErrorMessage(error))
      } else if (REFRESH_CODES.has(code)) {
        toast.error(getApiErrorMessage(error))
        onDeleted()
      } else {
        setServerError(getApiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  let body
  if (detail.error && !info) {
    body = (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-container/40 p-3 text-sm text-on-error-container">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(detail.error)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          <button type="button" onClick={() => setReloadToken((token) => token + 1)} className={`${secondaryButton} inline-flex items-center gap-2`}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      </div>
    )
  } else if (!info) {
    body = (
      <div aria-busy="true" aria-label="Checking room dependencies" className="space-y-3">
        <span className="block h-4 w-3/4 animate-pulse rounded bg-surface-container-high" />
        <span className="block h-4 w-1/2 animate-pulse rounded bg-surface-container-high" />
      </div>
    )
  } else if (!info.canDelete) {
    body = (
      <div className="space-y-5">
        <p className="flex items-start gap-3 rounded-lg bg-error-container/30 p-3 text-sm text-on-error-container">
          <Ban className="mt-0.5 size-5 shrink-0" />
          <span>
            {room.roomName} is linked to {pluralize(info.showtimeCount, 'showtime')}, so its history (bookings,
            tickets and payments) depends on it. A room like this is retired instead of deleted.
          </span>
        </p>
        {serverError && <p role="alert" className="text-xs text-on-surface-variant">{serverError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          <button
            type="button"
            onClick={onRetire}
            className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90"
          >
            Change status instead
          </button>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="space-y-5">
        <ul className="space-y-2 text-sm text-on-surface-variant">
          {[
            'The room and its seat map are removed permanently. This cannot be undone.',
            info.hasLayout
              ? `${pluralize(info.capacity, 'seat')} in the current seat map will be discarded.`
              : 'The room has no seat map yet.',
            'No showtime, booking or ticket refers to this room, so no history is lost.',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-on-surface-variant/60" />
              {item}
            </li>
          ))}
        </ul>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-on-surface">
            Type <span className="font-mono text-primary">{room.roomName}</span> to confirm
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoFocus
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-transparent bg-surface-container px-4 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:ring-2 focus:ring-primary-container/20"
          />
        </label>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-container/40 p-3 text-sm text-on-error-container">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || !matches}
            className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Deleting...' : 'Delete room'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <RoomOverlay
      icon={Trash2}
      title="Delete this room?"
      description={`${room.roomName} · ${room.branch.branchName ?? 'Unknown branch'}`}
      onClose={onClose}
      busy={submitting}
    >
      {body}
    </RoomOverlay>
  )
}

export default RoomDeleteDialog
