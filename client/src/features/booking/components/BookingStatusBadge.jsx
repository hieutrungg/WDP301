import { getBookingStatus } from '../utils/customerBookings'

const STATUS_TONE = {
  PAID: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  REFUNDED: 'border-sky-400/40 bg-sky-400/15 text-sky-300',
  REVIEW: 'border-secondary/40 bg-secondary/15 text-secondary',
  PENDING: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  EXPIRED: 'border-white/15 bg-white/5 text-on-surface-variant',
}

function BookingStatusBadge({ item, className = '' }) {
  const status = getBookingStatus(item)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-black uppercase tracking-wider ${STATUS_TONE[status.key]} ${className}`}
    >
      {status.label}
    </span>
  )
}

export default BookingStatusBadge
