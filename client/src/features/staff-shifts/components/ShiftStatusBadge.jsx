import { SHIFT_STATUS_META } from '../utils/staffShiftFormat'

function ShiftStatusBadge({ status }) {
  const meta = SHIFT_STATUS_META[status] ?? SHIFT_STATUS_META.SCHEDULED

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${meta.tone}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

export default ShiftStatusBadge
