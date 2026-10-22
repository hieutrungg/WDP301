import { ROOM_STATUS_STYLES } from '../utils/roomOptions'

function RoomStatusBadge({ status, showHint = false }) {
  const style = ROOM_STATUS_STYLES[status] ?? {
    label: 'Not set',
    hint: 'Set a status to schedule this room',
    badge: 'bg-surface-container-highest text-tertiary ring-white/10',
    dot: 'bg-tertiary-container',
  }

  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${style.badge}`}
      >
        <span className={`size-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>
      {showHint && <p className="mt-1.5 text-xs text-on-surface-variant">{style.hint}</p>}
    </div>
  )
}

export default RoomStatusBadge
