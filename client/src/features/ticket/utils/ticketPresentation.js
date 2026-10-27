// Display rules for TICKET-001 tickets. The server decides validity; these helpers only map the
// returned status to labels and never treat a ticket without a QR payload as admissible.
export const TICKET_STATUS_META = Object.freeze({
  ISSUED: {
    label: 'Valid for entry',
    tone: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    admissible: true,
  },
  USED: {
    label: 'Checked in',
    tone: 'border-white/20 bg-white/10 text-on-surface-variant',
    admissible: false,
  },
  INVALIDATED: {
    label: 'Invalidated',
    tone: 'border-error/40 bg-error/15 text-error',
    admissible: false,
  },
})

const UNKNOWN_STATUS = Object.freeze({
  label: 'Unavailable',
  tone: 'border-white/20 bg-white/10 text-on-surface-variant',
  admissible: false,
})

export function getTicketStatusMeta(status) {
  return TICKET_STATUS_META[status] ?? UNKNOWN_STATUS
}

export function isTicketAdmissible(ticket) {
  return Boolean(ticket?.qrCode) && getTicketStatusMeta(ticket?.status).admissible
}

// NFR 4.2.1 / CR-10: dd/MM/yyyy, 24-hour clock, Vietnam time regardless of the browser zone.
const VN_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatScreeningDateTime(isoValue) {
  if (!isoValue) return null
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(
    VN_PARTS.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

export function formatVnDateTime(isoValue, fallback = '') {
  const formatted = formatScreeningDateTime(isoValue)
  return formatted ? `${formatted.date} ${formatted.time}` : fallback
}

export function formatSeatType(type) {
  if (!type) return 'Standard'
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Neighbouring tickets of the same booking, for prev/next navigation on the fullscreen view.
export function getSiblingTickets(tickets, ticketId) {
  const index = (tickets ?? []).findIndex((ticket) => ticket.ticketId === ticketId)
  if (index === -1) return { index: -1, total: tickets?.length ?? 0, previous: null, next: null }
  return {
    index,
    total: tickets.length,
    previous: index > 0 ? tickets[index - 1] : null,
    next: index < tickets.length - 1 ? tickets[index + 1] : null,
  }
}

// C16 list summary from the Payment read's `ticketIssuance` (persisted tickets, not a preview).
export function describeTicketIssuance(issuance) {
  const tickets = issuance?.tickets ?? []
  const usedCount = tickets.filter((ticket) => ticket.status === 'USED').length
  const invalidCount = tickets.filter((ticket) => ticket.status === 'INVALIDATED').length
  const validCount = tickets.filter((ticket) => ticket.status === 'ISSUED').length

  let label = ''
  if (issuance?.status === 'ISSUANCE_PENDING') label = 'Tickets are being issued'
  else if (tickets.length > 0) {
    const parts = [`${tickets.length} ${tickets.length === 1 ? 'E-Ticket' : 'E-Tickets'}`]
    if (usedCount) parts.push(`${usedCount} checked in`)
    if (invalidCount) parts.push(`${invalidCount} invalidated`)
    label = parts.join(' · ')
  }

  return { ticketCount: tickets.length, validCount, usedCount, invalidCount, label }
}
