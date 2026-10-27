// TICKET-101 Staff check-in by ticket code (typed or pasted, no camera scan). The server decides
// admission; these helpers only normalize input and label the outcome.

export const TICKET_CODE_PATTERN = /^TK-[A-F0-9]{10}$/

export function normalizeTicketCode(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase()
}

// SRS 5.3 MSG01 / MSG03.
export function validateTicketCode(value) {
  const code = normalizeTicketCode(value)
  if (!code) return 'The Ticket code field is required.'
  if (!TICKET_CODE_PATTERN.test(code)) return 'The Ticket code format is invalid.'
  return ''
}

const OUTCOMES = {
  TICKET_ALREADY_USED: { title: 'Already checked in', tone: 'warning' },
  TICKET_INVALIDATED: { title: 'Ticket not valid', tone: 'danger' },
  TICKET_NOT_FOUND: { title: 'Ticket not found', tone: 'danger' },
  TICKET_WRONG_BRANCH: { title: 'Wrong branch', tone: 'danger' },
  TICKET_CHECK_IN_TOO_EARLY: { title: 'Too early to check in', tone: 'warning' },
  TICKET_SHOWTIME_ENDED: { title: 'Showtime has ended', tone: 'danger' },
  TICKET_SHOWTIME_UNAVAILABLE: { title: 'Showtime unavailable', tone: 'danger' },
  BRANCH_NOT_ASSIGNED: { title: 'No branch assigned', tone: 'danger' },
}

export function describeCheckInFailure(error) {
  const code = error?.response?.data?.code ?? null
  const outcome = OUTCOMES[code] ?? { title: 'Check-in failed', tone: 'danger' }
  const message = error?.response
    ? error.response.data?.errors?.[0]?.message || error.response.data?.message || 'Something went wrong. Please try again.'
    : 'Unable to reach the server. Please check your connection and try again.'
  return { ...outcome, code, message }
}

export function bookingProgressLabel(bookingCheckIn) {
  if (!bookingCheckIn?.ticketCount) return ''
  const { checkedInCount, ticketCount } = bookingCheckIn
  return `${checkedInCount} of ${ticketCount} ${ticketCount === 1 ? 'ticket' : 'tickets'} in this booking checked in`
}
