import { Ban, CalendarClock, TriangleAlert, Wrench } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { changeRoomStatusRequest } from '../api/roomApi'
import { ROOM_STATUSES } from '../schema/roomSchema'
import { getApiErrorCode, pluralize } from '../utils/roomFormat'
import RoomOverlay from './RoomOverlay'
import { ROOM_STATUS_STYLES } from '../utils/roomOptions'
import RoomStatusBadge from './RoomStatusBadge'

const REFRESH_CODES = new Set(['ROOM_STATUS_CONFLICT', 'ROOM_NOT_FOUND'])

const EFFECTS = {
  ACTIVE: 'The room can be scheduled for new showtimes (it also needs a seat map).',
  MAINTENANCE: 'The room is closed for scheduling. Rooms, seat maps and history are kept.',
  INACTIVE: 'The room is retired and cannot be scheduled. Rooms, seat maps and history are kept.',
}

function RoomStatusDialog({ room, onClose, onChanged }) {
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const upcoming = room.upcomingShowtimeCount
  // Mirrors the server rule: a room cannot leave service while customers can book an upcoming session.
  const blockedByShowtimes = selected && selected !== 'ACTIVE' && upcoming > 0

  const handleConfirm = async () => {
    setSubmitting(true)
    setServerError('')

    try {
      const updated = await changeRoomStatusRequest(room.id, selected)
      toast.success('Room status updated', {
        description: `${updated.roomName} is now ${ROOM_STATUS_STYLES[updated.status]?.label.toLowerCase() ?? updated.status}.`,
      })
      onChanged()
    } catch (error) {
      const code = getApiErrorCode(error)

      if (code === 'ROOM_HAS_FUTURE_SHOWTIMES') {
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
      <RoomOverlay icon={Ban} title="Action blocked" description="Upcoming showtime dependencies" onClose={onClose}>
        <div className="space-y-5">
          <div className="rounded-xl border border-primary-container/30 bg-primary-container/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Target room</p>
            <p className="mt-1 font-heading text-lg font-bold text-on-surface">{room.roomName}</p>
            <p className="mt-1 text-xs text-secondary">Status stays {ROOM_STATUS_STYLES[room.status]?.label ?? 'unchanged'}</p>
          </div>
          <p className="flex items-start gap-3 rounded-lg bg-error-container/30 p-3 text-sm text-on-error-container">
            <CalendarClock className="mt-0.5 size-5 shrink-0" />
            {blockedMessage}
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
      </RoomOverlay>
    )
  }

  return (
    <RoomOverlay
      icon={Wrench}
      title="Change room status"
      description={`${room.roomName} · ${room.branch.branchName ?? 'Unknown branch'}`}
      onClose={onClose}
      busy={submitting}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-lowest/70 px-3 py-2 text-xs text-on-surface-variant">
          Current status
          <RoomStatusBadge status={room.status} />
        </div>

        <fieldset className="grid gap-2">
          <legend className="sr-only">New status</legend>
          {ROOM_STATUSES.filter((status) => status !== room.status).map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-surface-container p-3 has-[:checked]:border-primary-container/50 has-[:checked]:bg-primary-container/10"
            >
              <input
                type="radio"
                name="room-status"
                value={status}
                checked={selected === status}
                onChange={() => setSelected(status)}
                className="mt-1 accent-primary-container"
              />
              <span>
                <span className="block text-sm font-semibold text-on-surface">{ROOM_STATUS_STYLES[status].label}</span>
                <span className="text-xs text-on-surface-variant">{EFFECTS[status]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {blockedByShowtimes && (
          <p className="flex items-start gap-3 rounded-lg bg-secondary/10 p-3 text-sm text-secondary">
            <CalendarClock className="mt-0.5 size-5 shrink-0" />
            This room has {pluralize(upcoming, 'upcoming published showtime')}. Cancel or reschedule
            {upcoming === 1 ? ' it' : ' them'} before taking the room out of service.
          </p>
        )}

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
            disabled={submitting || !selected || blockedByShowtimes}
            className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Update status'}
          </button>
        </div>
      </div>
    </RoomOverlay>
  )
}

export default RoomStatusDialog
