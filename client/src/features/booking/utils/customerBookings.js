// Rules that split the customer's bookings (GET /api/payments/me/bookings) into the two screens:
// My Tickets lists only tickets that can still be used; Booking History lists every booking.
// The server stays the authority on admission; these helpers only decide what to show.

const toTime = (value) => {
  const time = Date.parse(value ?? '')
  return Number.isFinite(time) ? time : null
}

export function isPaidBooking(item) {
  return item?.booking?.status === 'CONFIRMED' && item?.payment?.status === 'PAID'
}

export function getShowtimeEndTime(item) {
  return toTime(item?.showtime?.endAt) ?? toTime(item?.showtime?.startAt)
}

export function hasShowtimeEnded(item, now) {
  const end = getShowtimeEndTime(item)
  return end !== null && end <= now
}

// A paid booking whose screening has not ended and which still has a ticket valid for entry
// (or whose tickets are still being issued).
export function isUsableTicketBooking(item, now) {
  if (!isPaidBooking(item) || hasShowtimeEnded(item, now)) return false
  const issuance = item.ticketIssuance
  if (issuance?.status === 'ISSUANCE_PENDING') return true
  const tickets = issuance?.tickets ?? []
  return tickets.length === 0 || tickets.some((ticket) => ticket.status === 'ISSUED')
}

// Soonest screening first.
export function selectUsableTickets(items, now) {
  return (items ?? [])
    .filter((item) => isUsableTicketBooking(item, now))
    .sort((a, b) => (toTime(a.showtime?.startAt) ?? Infinity) - (toTime(b.showtime?.startAt) ?? Infinity))
}

export function getBookingStatus(item) {
  const { booking, payment } = item ?? {}
  if (booking?.status === 'REFUNDED') {
    return {
      key: 'REFUNDED',
      label: payment?.status === 'PARTIALLY_REFUNDED' ? 'PARTIALLY REFUNDED' : 'REFUNDED',
    }
  }
  if (isPaidBooking(item)) return { key: 'PAID', label: 'PAID' }
  if (payment?.status === 'REVIEW_REQUIRED') return { key: 'REVIEW', label: 'UNDER REVIEW' }
  if (booking?.status === 'PENDING_PAYMENT') return { key: 'PENDING', label: 'AWAITING PAYMENT' }
  return { key: 'EXPIRED', label: 'EXPIRED' }
}

export const HISTORY_FILTERS = Object.freeze([
  { id: 'ALL', label: 'All' },
  { id: 'PAID', label: 'Paid' },
  { id: 'PENDING', label: 'Awaiting payment' },
  { id: 'EXPIRED', label: 'Expired / Under review' },
  { id: 'REFUNDED', label: 'Refunded' },
])

const FILTER_KEYS = Object.freeze({
  PAID: ['PAID'],
  PENDING: ['PENDING'],
  EXPIRED: ['EXPIRED', 'REVIEW'],
  REFUNDED: ['REFUNDED'],
})

export function matchesHistoryFilter(item, filterId) {
  if (filterId === 'ALL') return true
  return (FILTER_KEYS[filterId] ?? []).includes(getBookingStatus(item).key)
}

export function countHistoryFilters(items) {
  return Object.fromEntries(
    HISTORY_FILTERS.map(({ id }) => [id, (items ?? []).filter((item) => matchesHistoryFilter(item, id)).length]),
  )
}

// Newest booking first.
export function sortHistory(items) {
  const bookedAt = (item) => toTime(item.booking?.bookingTime) ?? toTime(item.booking?.createdAt) ?? 0
  return [...(items ?? [])].sort((a, b) => bookedAt(b) - bookedAt(a))
}

// Short label next to an upcoming ticket: "Now showing", "Starts in 2h 15m", "In 3 days".
export function describeStartsIn(item, now) {
  const start = toTime(item?.showtime?.startAt)
  if (start === null) return ''
  const minutes = Math.round((start - now) / 60000)
  if (minutes <= 0) return 'Now showing'
  if (minutes < 60) return `Starts in ${minutes}m`
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `Starts in ${hours}h ${rest}m` : `Starts in ${hours}h`
  }
  const days = Math.round(minutes / (24 * 60))
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

export function getMovieTitle(showtime) {
  return showtime?.movieTitle || showtime?.movie?.title || 'F-Cinema screening'
}

export function getCinemaName(showtime) {
  return showtime?.cinemaName || showtime?.cinema?.branchName || 'F-Cinema'
}

export function getRoomName(showtime) {
  return showtime?.roomName || showtime?.room?.roomName || 'Hall'
}

export function getBookingAmount(item) {
  return item?.payment?.amount ?? item?.booking?.totalAmount ?? item?.booking?.amount ?? 0
}

export function getBookingRef(booking) {
  return booking?.bookingCode || booking?.payableReference || booking?.bookingId || ''
}
