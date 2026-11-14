import test from 'node:test'
import assert from 'node:assert/strict'
import {
  countHistoryFilters,
  describeStartsIn,
  getBookingStatus,
  isUsableTicketBooking,
  selectUsableTickets,
  sortHistory,
} from '../src/features/booking/utils/customerBookings.js'

const NOW = Date.parse('2026-11-15T10:00:00Z')
const HOUR = 3600000
const iso = (offset) => new Date(NOW + offset).toISOString()

const paid = ({ start = 2 * HOUR, end = 4 * HOUR, tickets = [{ status: 'ISSUED' }], issuance = 'ISSUED' } = {}) => ({
  booking: { bookingId: `b${start}`, status: 'CONFIRMED', bookingTime: iso(-start) },
  payment: { status: 'PAID' },
  showtime: { startAt: iso(start), endAt: iso(end) },
  ticketIssuance: { status: issuance, tickets },
})

test('a paid booking with an upcoming screening and a valid ticket is usable', () => {
  assert.equal(isUsableTicketBooking(paid(), NOW), true)
})

test('a screening still in progress keeps its tickets usable', () => {
  assert.equal(isUsableTicketBooking(paid({ start: -HOUR, end: HOUR }), NOW), true)
})

test('tickets of a finished screening are not usable', () => {
  assert.equal(isUsableTicketBooking(paid({ start: -4 * HOUR, end: -2 * HOUR }), NOW), false)
})

test('a booking whose tickets were all checked in or invalidated is not usable', () => {
  const tickets = [{ status: 'USED' }, { status: 'INVALIDATED' }]
  assert.equal(isUsableTicketBooking(paid({ tickets }), NOW), false)
})

test('tickets still being issued stay on My Tickets', () => {
  assert.equal(isUsableTicketBooking(paid({ tickets: [], issuance: 'ISSUANCE_PENDING' }), NOW), true)
})

test('unpaid, expired and refunded bookings are never usable tickets', () => {
  const pending = { ...paid(), booking: { status: 'PENDING_PAYMENT' }, payment: { status: 'PENDING' } }
  const refunded = { ...paid(), booking: { status: 'REFUNDED' }, payment: { status: 'REFUNDED' } }
  assert.equal(isUsableTicketBooking(pending, NOW), false)
  assert.equal(isUsableTicketBooking(refunded, NOW), false)
})

test('usable tickets are sorted by the soonest screening', () => {
  const later = paid({ start: 30 * HOUR, end: 32 * HOUR })
  const sooner = paid({ start: HOUR, end: 3 * HOUR })
  const ended = paid({ start: -5 * HOUR, end: -3 * HOUR })
  assert.deepEqual(selectUsableTickets([later, ended, sooner], NOW), [sooner, later])
})

test('status labels are short and PAID replaces CONFIRMED • PAID', () => {
  assert.deepEqual(getBookingStatus(paid()), { key: 'PAID', label: 'PAID' })
  assert.equal(getBookingStatus({ booking: { status: 'PENDING_PAYMENT' }, payment: null }).label, 'AWAITING PAYMENT')
  assert.equal(getBookingStatus({ booking: { status: 'EXPIRED' }, payment: { status: 'REVIEW_REQUIRED' } }).key, 'REVIEW')
  assert.equal(getBookingStatus({ booking: { status: 'REFUNDED' }, payment: { status: 'PARTIALLY_REFUNDED' } }).label, 'PARTIALLY REFUNDED')
  assert.equal(getBookingStatus({ booking: { status: 'EXPIRED' }, payment: { status: 'EXPIRED' } }).label, 'EXPIRED')
})

test('history filter counts group review with expired bookings', () => {
  const items = [
    paid(),
    { booking: { status: 'EXPIRED' }, payment: { status: 'REVIEW_REQUIRED' } },
    { booking: { status: 'EXPIRED' }, payment: { status: 'EXPIRED' } },
    { booking: { status: 'PENDING_PAYMENT' }, payment: null },
  ]
  assert.deepEqual(countHistoryFilters(items), { ALL: 4, PAID: 1, PENDING: 1, EXPIRED: 2, REFUNDED: 0 })
})

test('history lists the newest booking first', () => {
  const older = paid({ start: 5 * HOUR, end: 7 * HOUR })
  const newer = paid({ start: HOUR, end: 3 * HOUR })
  assert.deepEqual(sortHistory([older, newer]), [newer, older])
})

test('describeStartsIn gives a short countdown', () => {
  assert.equal(describeStartsIn({ showtime: { startAt: iso(-60000) } }, NOW), 'Now showing')
  assert.equal(describeStartsIn({ showtime: { startAt: iso(45 * 60000) } }, NOW), 'Starts in 45m')
  assert.equal(describeStartsIn({ showtime: { startAt: iso(2 * HOUR + 15 * 60000) } }, NOW), 'Starts in 2h 15m')
  assert.equal(describeStartsIn({ showtime: { startAt: iso(26 * HOUR) } }, NOW), 'Tomorrow')
  assert.equal(describeStartsIn({ showtime: { startAt: iso(72 * HOUR) } }, NOW), 'In 3 days')
})
