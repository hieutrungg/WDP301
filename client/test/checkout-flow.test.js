import test from 'node:test'
import assert from 'node:assert/strict'
import { newCheckout, writeCheckout, readCheckout, clearCheckout, remainingHoldMs, validHoldQuote, paymentHandoff } from '../src/features/booking/utils/checkoutSession.js'
import { restoreCheckout, submitBooking } from '../src/features/booking/utils/checkoutFlow.js'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  getPaymentMethodOption,
  buildPaymentAttemptKey,
  generateDeterministicQrMatrix,
} from '../src/features/booking/utils/mockQrCode.js'

const storageFixture = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}
const attemptFixture = () => newCheckout({ ownerId: 'customer-a', showtimeId: 'showtime-a', seats: [{ seatId: 'seat-a', row: 'B', number: 3, type: 'VIP' }], createKey: (() => { let i = 0; return () => `unique-key-${++i}` })() })
const holdFixture = () => ({ holdId: 'hold-a', ownerId: 'customer-a', showtimeId: 'showtime-a', seatIds: ['seat-a'], status: 'ACTIVE', expiresAt: '2026-10-20T14:10:00Z', serverNow: '2026-10-20T14:00:00Z', priceQuote: { quoteId: 'quote-a', currency: 'VND', lines: [{ seatId: 'seat-a', unitPrice: 110500 }], totalAmount: 110500 } })
const bookingFixture = () => ({ bookingId: 'booking-a', payableReference: 'pay-a', status: 'PENDING_PAYMENT', amount: 110500, currency: 'VND', expiresAt: '2026-10-20T14:10:00Z' })

test('checkout recovery is scoped to the account, showtime and browser tab storage', () => {
  const storage = storageFixture(), attempt = attemptFixture()
  writeCheckout(storage, attempt)
  assert.deepEqual(readCheckout(storage, attempt.ownerId, attempt.showtimeId), attempt)
  assert.equal(readCheckout(storage, 'another-customer', attempt.showtimeId), null)
  assert.equal(readCheckout(storage, attempt.ownerId, 'another-showtime'), null)
  clearCheckout(storage, attempt.ownerId, attempt.showtimeId)
  assert.equal(readCheckout(storage, attempt.ownerId, attempt.showtimeId), null)
  storage.getItem = () => '{broken'
  assert.equal(readCheckout(storage, attempt.ownerId, attempt.showtimeId), null)
})

test('server countdown includes time in background and never grants a new ten minutes on reload', () => {
  const hold = holdFixture()
  assert.equal(remainingHoldMs(hold, 1000, 31000), 570000)
  assert.equal(remainingHoldMs(hold, 1000, 601000), 0)
  assert.equal(remainingHoldMs({ ...hold, serverNow: 'invalid' }, 1000, 2000), 0)
})

test('opening checkout acquires the original hold command without creating a Booking', async () => {
  const attempt = attemptFixture(), hold = holdFixture()
  let commands = []
  const result = await restoreCheckout({ attempt, acquire: async (command) => { commands.push(command); return hold }, createBooking: () => assert.fail('No implicit Booking creation'), clock: () => 1234 })
  assert.deepEqual(commands, [{ showtimeId: attempt.showtimeId, seatIds: attempt.seatIds, checkoutKey: attempt.checkoutKey }])
  assert.equal(result.receivedAt, 1234)
  assert.equal(result.booking, null)
})

test('lost Booking response and a reload reuse the exact persisted request key and server quote', async () => {
  const storage = storageFixture(), attempt = attemptFixture(), hold = holdFixture()
  let savedBooking, commands = []
  const createBooking = async (command) => {
    commands.push(command)
    assert.equal(readCheckout(storage, attempt.ownerId, attempt.showtimeId).bookingRequested, true)
    if (!savedBooking) { savedBooking = bookingFixture(); throw new Error('response lost after commit') }
    return savedBooking
  }
  await assert.rejects(submitBooking({ attempt, hold, storage, createBooking }), /response lost/)
  const recovered = await restoreCheckout({ attempt: readCheckout(storage, attempt.ownerId, attempt.showtimeId), acquire: async () => hold, createBooking })
  assert.deepEqual(commands[0], commands[1])
  assert.deepEqual(commands[0], { holdId: hold.holdId, requestKey: attempt.requestKey, priceQuoteReference: 'quote-a' })
  assert.deepEqual(recovered.booking, savedBooking)
})

test('a storage failure prevents sending a Booking request that could not be recovered', async () => {
  const storage = { setItem() { throw new Error('storage blocked') } }
  await assert.rejects(submitBooking({ attempt: attemptFixture(), hold: holdFixture(), storage, createBooking: () => assert.fail('Must persist before POST') }), /storage blocked/)
})

test('wrong owner, seat set, currency and invalid server prices fail closed', async () => {
  const attempt = attemptFixture(), hold = holdFixture()
  assert.equal(validHoldQuote(hold, attempt), true)
  for (const invalid of [
    { ...hold, ownerId: 'another-customer' }, { ...hold, seatIds: ['seat-b'] },
    { ...hold, priceQuote: { ...hold.priceQuote, currency: 'USD' } },
    { ...hold, priceQuote: { ...hold.priceQuote, lines: [{ seatId: 'seat-a', unitPrice: -1 }] } },
    { ...hold, priceQuote: { ...hold.priceQuote, totalAmount: 0 } },
  ]) {
    assert.equal(validHoldQuote(invalid, attempt), false)
    await assert.rejects(restoreCheckout({ attempt, acquire: async () => invalid, createBooking: () => assert.fail('Reject malformed quote first') }), /invalid seat quote/)
  }
})

test('Booking replay reads server status without locally confirming payment; mismatched amounts fail', () => {
  return (async () => {
    const attempt = { ...attemptFixture(), bookingRequested: true }, hold = holdFixture()
    const pending = await restoreCheckout({ attempt, acquire: async () => hold, createBooking: async () => bookingFixture() })
    assert.equal(pending.booking.status, 'PENDING_PAYMENT')
    const expired = await restoreCheckout({ attempt, acquire: async () => ({ ...hold, status: 'EXPIRED' }), createBooking: async () => ({ ...bookingFixture(), status: 'EXPIRED' }) })
    assert.equal(expired.booking.status, 'EXPIRED')
    await assert.rejects(submitBooking({ attempt, hold, createBooking: async () => ({ ...bookingFixture(), amount: 0 }) }), /could not be verified/)
    assert.deepEqual(paymentHandoff(pending.booking), { bookingId: 'booking-a', payableReference: 'pay-a', amount: 110500, currency: 'VND', expiresAt: '2026-10-20T14:10:00Z' })
  })()
})

test('PAY-001 preserves all 4 C14 payment methods and generates deterministic mock QR matrices', () => {
  assert.equal(PAYMENT_METHOD_OPTIONS.length, 4)
  assert.deepEqual(
    PAYMENT_METHOD_OPTIONS.map((item) => item.id),
    [
      PAYMENT_METHODS.MOMO_WALLET,
      PAYMENT_METHODS.VNPAY_QR,
      PAYMENT_METHODS.CREDIT_DEBIT_CARD,
      PAYMENT_METHODS.ZALOPAY_APPLE_PAY,
    ],
  )
  assert.equal(getPaymentMethodOption('VNPAY_QR').label, 'VNPAY-QR / VietQR')
  assert.equal(
    buildPaymentAttemptKey({
      bookingId: 'booking-123',
      method: 'MOMO_WALLET',
      attemptSequence: 2,
    }),
    'pay-attempt:booking-123:MOMO_WALLET:2',
  )

  const matrixA = generateDeterministicQrMatrix('FCINEMA-MOCK://payment/ATT-1', 25)
  const matrixB = generateDeterministicQrMatrix('FCINEMA-MOCK://payment/ATT-1', 25)
  const matrixC = generateDeterministicQrMatrix('ETKT-PREVIEW-PAY-1', 25)

  assert.equal(matrixA.length, 25)
  assert.equal(matrixA[0].length, 25)
  assert.deepEqual(matrixA, matrixB)
  assert.notDeepEqual(matrixA, matrixC)
})
