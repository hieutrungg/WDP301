import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingProgressLabel,
  describeCheckInFailure,
  normalizeTicketCode,
  validateTicketCode,
} from '../src/features/ticket/utils/checkIn.js'

test('TICKET-101 ticket code is typed or pasted; spaces and case are ignored', () => {
  assert.equal(normalizeTicketCode(' tk-1a2b 3c4d5e '), 'TK-1A2B3C4D5E')
  assert.equal(validateTicketCode('tk-1a2b3c4d5e'), '')
  assert.equal(validateTicketCode('   '), 'The Ticket code field is required.')
  assert.equal(validateTicketCode('TK-123'), 'The Ticket code format is invalid.')
})

test('TICKET-101 failures map to a clear title and keep the server message', () => {
  const used = describeCheckInFailure({
    response: { data: { code: 'TICKET_ALREADY_USED', message: 'Ticket TK-1 was already checked in.' } },
  })
  assert.deepEqual(used, {
    title: 'Already checked in',
    tone: 'warning',
    code: 'TICKET_ALREADY_USED',
    message: 'Ticket TK-1 was already checked in.',
  })
  assert.equal(describeCheckInFailure({ response: { data: { code: 'TICKET_WRONG_BRANCH', message: 'x' } } }).title, 'Wrong branch')
  assert.equal(describeCheckInFailure({}).message, 'Unable to reach the server. Please check your connection and try again.')
  const validation = describeCheckInFailure({
    response: { data: { code: 'TICKET_CHECK_IN_VALIDATION_FAILED', message: 'Validation failed', errors: [{ message: 'The Ticket code format is invalid.' }] } },
  })
  assert.equal(validation.title, 'Check-in failed')
  assert.equal(validation.message, 'The Ticket code format is invalid.')
})

test('TICKET-101 booking progress label', () => {
  assert.equal(bookingProgressLabel({ ticketCount: 2, checkedInCount: 1 }), '1 of 2 tickets in this booking checked in')
  assert.equal(bookingProgressLabel({ ticketCount: 1, checkedInCount: 1 }), '1 of 1 ticket in this booking checked in')
  assert.equal(bookingProgressLabel(null), '')
})
