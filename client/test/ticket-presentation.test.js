import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTicketQrPayload,
  formatScreeningDateTime,
  formatSeatType,
  formatVnDateTime,
  getSiblingTickets,
  getTicketStatusMeta,
  isTicketAdmissible,
} from '../src/features/ticket/utils/ticketPresentation.js'

test('ticket QR opens the F-Cinema ticket information page', () => {
  const payload = buildTicketQrPayload({
    ticketCode: 'TK-ABCDEF1234',
    screening: {
      movieTitle: 'DUNE: Part 3',
      cinemaName: 'F-Cinema Central',
      roomName: 'Room 01',
      startAt: '2026-11-14T04:00:00.000Z',
    },
    seat: { label: 'C3' },
  }, 'https://demo.fcinema.vn')
  const url = new URL(payload)
  assert.equal(url.origin, 'https://demo.fcinema.vn')
  assert.equal(url.pathname, '/ticket-info')
  assert.equal(url.searchParams.get('code'), 'TK-ABCDEF1234')
  assert.equal(url.searchParams.get('movie'), 'DUNE: Part 3')
  assert.equal(url.searchParams.get('showtime'), '11:00 14/11/2026')
  assert.equal(url.searchParams.get('seat'), 'C3')
})

test('only an ISSUED ticket with a QR payload is shown as admissible', () => {
  assert.equal(isTicketAdmissible({ status: 'ISSUED', qrCode: 'FCINEMA-TICKET:v1:TK-1:x' }), true)
  assert.equal(isTicketAdmissible({ status: 'ISSUED', qrCode: null }), false)
  assert.equal(isTicketAdmissible({ status: 'USED', qrCode: 'stale' }), false)
  assert.equal(isTicketAdmissible({ status: 'INVALIDATED', qrCode: 'stale' }), false)
  assert.equal(isTicketAdmissible(null), false)
})

test('status labels cover every server status and fail closed for unknown values', () => {
  assert.equal(getTicketStatusMeta('ISSUED').label, 'Valid for entry')
  assert.equal(getTicketStatusMeta('USED').label, 'Checked in')
  assert.equal(getTicketStatusMeta('INVALIDATED').label, 'Invalidated')
  assert.equal(getTicketStatusMeta('SOMETHING_NEW').admissible, false)
})

test('screening time uses dd/MM/yyyy and 24-hour Vietnam time regardless of the browser zone', () => {
  assert.deepEqual(formatScreeningDateTime('2026-10-24T12:30:00.000Z'), { date: '24/10/2026', time: '19:30' })
  // 17:05 UTC is past midnight in Vietnam: the date rolls over and the hour stays 24-hour.
  assert.deepEqual(formatScreeningDateTime('2026-12-31T17:05:00.000Z'), { date: '01/01/2027', time: '00:05' })
  assert.equal(formatVnDateTime('2026-10-24T12:30:00.000Z'), '24/10/2026 19:30')
  assert.equal(formatVnDateTime(null, 'Verified'), 'Verified')
  assert.equal(formatScreeningDateTime(null), null)
  assert.equal(formatScreeningDateTime('not-a-date'), null)
})

test('seat types and sibling navigation are derived from the booking ticket list', () => {
  assert.equal(formatSeatType('DOUBLE_LUXURY'), 'Double Luxury')
  assert.equal(formatSeatType(undefined), 'Standard')

  const tickets = [{ ticketId: 'a' }, { ticketId: 'b' }, { ticketId: 'c' }]
  assert.deepEqual(getSiblingTickets(tickets, 'b'), { index: 1, total: 3, previous: tickets[0], next: tickets[2] })
  assert.equal(getSiblingTickets(tickets, 'a').previous, null)
  assert.equal(getSiblingTickets(tickets, 'c').next, null)
  assert.equal(getSiblingTickets(undefined, 'a').total, 0)
})

test('C16 summarizes persisted tickets instead of a preview reference', async () => {
  const { describeTicketIssuance } = await import('../src/features/ticket/utils/ticketPresentation.js')
  const summary = describeTicketIssuance({
    status: 'ISSUED',
    tickets: [
      { ticketId: 'a', status: 'ISSUED' },
      { ticketId: 'b', status: 'USED' },
    ],
  })
  assert.deepEqual(summary, { ticketCount: 2, validCount: 1, usedCount: 1, invalidCount: 0, label: '2 E-Tickets · 1 checked in' })
  assert.equal(describeTicketIssuance({ status: 'ISSUANCE_PENDING', tickets: [] }).label, 'Tickets are being issued')
  assert.equal(describeTicketIssuance(null).label, '')
})
