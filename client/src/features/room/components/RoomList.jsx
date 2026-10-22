import { Armchair, CalendarClock, Grid3x3, MapPin, Pencil, Power, Trash2, TriangleAlert, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { formatCount, formatDateTime, pluralize } from '../utils/roomFormat'
import RoomStatusBadge from './RoomStatusBadge'

const writeColumns =
  'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1fr)_9rem_minmax(0,14rem)]'
const readColumns = 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1fr)_9rem]'

const actionClass =
  'inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-2.5 py-2 text-xs font-semibold transition-colors'

function ActionButton({ icon: Icon, label, onClick, tone = 'default' }) {
  const tones = {
    default: 'text-on-surface hover:bg-surface-container-highest',
    danger: 'text-primary hover:bg-primary-container/15',
    success: 'text-secondary hover:bg-secondary/10',
  }

  return (
    <button type="button" onClick={onClick} className={`${actionClass} ${tones[tone]}`}>
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function SeatBreakdown({ room }) {
  if (!room.hasLayout) {
    return (
      <p className="flex items-center gap-2 text-sm text-on-surface-variant">
        <TriangleAlert className="size-4 shrink-0 text-secondary" />
        No seat map yet
      </p>
    )
  }

  const { standardCount, vipCount, doubleLuxuryCount, accessibleCount, disabledCount } = room.seatCounts
  const parts = [
    ['Std', standardCount, 'text-on-surface'],
    ['VIP', vipCount, 'text-secondary'],
    ['Luxury', doubleLuxuryCount, 'text-primary'],
  ].filter(([, count]) => count > 0)

  return (
    <div>
      <p className="font-heading text-base font-bold text-on-surface">
        {formatCount(room.capacity)} <span className="text-xs font-normal text-on-surface-variant">seats</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-on-surface-variant">
        {parts.map(([label, count, tone]) => (
          <span key={label} className={tone}>
            {count} {label}
          </span>
        ))}
        {accessibleCount > 0 && <span className="text-tertiary">{accessibleCount} Acc</span>}
        {disabledCount > 0 && <span className="text-on-surface-variant/70">{disabledCount} off</span>}
      </p>
    </div>
  )
}

function RoomRow({ room, readOnly, onEdit, onChangeStatus, onDelete }) {
  const retired = room.status === 'INACTIVE'
  const upcoming = room.upcomingShowtimeCount
  const updated = formatDateTime(room.layoutUpdatedAt)

  return (
    <li className="border-t border-white/5 first:border-t-0">
      <div className={`grid gap-3 px-4 py-4 lg:items-start lg:gap-4 lg:px-5 ${readOnly ? readColumns : writeColumns}`}>
        <div className="min-w-0">
          <p className={`font-heading text-base font-bold ${retired ? 'text-on-surface/60' : 'text-on-surface'}`}>
            {room.roomName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{room.branch.branchName ?? 'Unknown branch'}</span>
          </p>
        </div>

        <div>
          {room.roomType ? (
            <span className="inline-flex rounded-full bg-surface-container-highest px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-tertiary">
              {room.roomType}
            </span>
          ) : (
            <span className="text-sm text-on-surface-variant/70">No format</span>
          )}
        </div>

        <div>
          <SeatBreakdown room={room} />
          {room.hasLayout && updated && (
            <p className="mt-1 text-[11px] text-on-surface-variant/70">
              Seat map v{room.layoutVersion} · {updated}
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
          {upcoming > 0 ? (
            <span className="text-on-surface">{pluralize(upcoming, 'upcoming showtime')}</span>
          ) : (
            <span className="text-on-surface-variant/70">No upcoming showtimes</span>
          )}
        </p>

        <RoomStatusBadge status={room.status} showHint />

        {!readOnly && (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              to={`/manager/seat-maps?roomId=${room.id}`}
              className={`${actionClass} text-on-surface hover:bg-surface-container-highest`}
            >
              <Grid3x3 className="size-3.5" />
              Seat map
            </Link>
            <ActionButton icon={Pencil} label="Edit" onClick={onEdit} />
            {room.status === 'ACTIVE' ? (
              <ActionButton icon={Wrench} label="Status" onClick={onChangeStatus} />
            ) : (
              <ActionButton icon={Power} label="Status" tone="success" onClick={onChangeStatus} />
            )}
            <ActionButton icon={Trash2} label="Delete" tone="danger" onClick={onDelete} />
          </div>
        )}
      </div>
    </li>
  )
}

function RoomList({ rooms, readOnly, onEdit, onChangeStatus, onDelete }) {
  return (
    <div>
      <div
        className={`hidden gap-4 border-b border-white/5 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant lg:grid ${readOnly ? readColumns : writeColumns}`}
      >
        <span>Room</span>
        <span>Format</span>
        <span className="flex items-center gap-1.5">
          <Armchair className="size-3.5" />
          Seating
        </span>
        <span>Programming</span>
        <span>Status</span>
        {!readOnly && <span className="text-right">Actions</span>}
      </div>
      <ul>
        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            readOnly={readOnly}
            onEdit={() => onEdit(room)}
            onChangeStatus={() => onChangeStatus(room)}
            onDelete={() => onDelete(room)}
          />
        ))}
      </ul>
    </div>
  )
}

export default RoomList
