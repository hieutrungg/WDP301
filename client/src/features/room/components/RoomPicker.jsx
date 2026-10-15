import { Building2, ChevronDown, RefreshCw } from 'lucide-react'
import { getApiErrorMessage } from '../../../lib/api/apiError'

const selectClass =
  'w-full appearance-none rounded-lg bg-surface-container-high px-3.5 py-2.5 pr-9 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50'

const groupRoomsByBranch = (rooms) => {
  const branches = new Map()
  for (const room of rooms) {
    const key = room.branch.id
    if (!branches.has(key)) branches.set(key, { ...room.branch, rooms: [] })
    branches.get(key).rooms.push(room)
  }
  return [...branches.values()].sort((a, b) => (a.branchName ?? '').localeCompare(b.branchName ?? ''))
}

function Select({ id, label, value, onChange, disabled, children }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={selectClass}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-5 text-tertiary" />
      </div>
    </div>
  )
}

function RoomPicker({ rooms, loading, error, roomId, onSelectRoom, onRetry, room }) {
  const branches = groupRoomsByBranch(rooms ?? [])
  const branch = branches.find((item) => item.rooms.some(({ id }) => id === roomId))

  return (
    <section className="grid gap-4 rounded-2xl border border-white/5 bg-surface-container-low p-5" aria-label="Branch and room">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-on-surface">
          <Building2 className="size-5 text-primary-container" />
          Branch &amp; Room
        </h2>
        {room?.roomType && (
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tertiary">
            {room.roomType}
          </span>
        )}
      </div>

      {loading && !rooms ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading rooms">
          <span className="h-10 animate-pulse rounded-lg bg-surface-container-high" />
          <span className="h-10 animate-pulse rounded-lg bg-surface-container-high" />
        </div>
      ) : error && !rooms ? (
        <div role="alert" className="grid gap-3 rounded-lg bg-error-container/30 p-3 text-sm text-on-error-container">
          {getApiErrorMessage(error)}
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 font-semibold underline">
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      ) : branches.length === 0 ? (
        <p className="rounded-lg bg-surface-container p-3 text-sm text-on-surface-variant">
          No rooms exist yet. A room must be created for a branch before its seat map can be configured.
        </p>
      ) : (
        <>
          <Select
            id="seat-map-branch"
            label="Theater complex"
            value={branch?.id ?? ''}
            onChange={(branchId) => {
              const target = branches.find(({ id }) => id === branchId)
              if (target) onSelectRoom(target.rooms[0].id)
            }}
          >
            {!branch && <option value="">Select a branch</option>}
            {branches.map(({ id, branchName, status }) => (
              <option key={id} value={id}>
                {branchName ?? 'Unknown branch'}
                {status === 'INACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>

          <Select id="seat-map-room" label="Screening room" value={roomId ?? ''} onChange={onSelectRoom} disabled={!branch}>
            {!branch && <option value="">Select a room</option>}
            {(branch?.rooms ?? []).map(({ id, roomName, hasLayout, capacity }) => (
              <option key={id} value={id}>
                {roomName} — {hasLayout ? `${capacity} seats` : 'no seat map'}
              </option>
            ))}
          </Select>
        </>
      )}
    </section>
  )
}

export default RoomPicker
