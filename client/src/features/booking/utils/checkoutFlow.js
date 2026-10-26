import { bookingMatchesHold, validHoldQuote, writeCheckout } from './checkoutSession.js'

export async function restoreCheckout({ attempt, acquire, createBooking, clock = Date.now }) {
  const hold = await acquire({
    showtimeId: attempt.showtimeId, seatIds: attempt.seatIds, checkoutKey: attempt.checkoutKey,
  })
  const receivedAt = clock()
  if (!validHoldQuote(hold, attempt)) throw new Error('The server returned an invalid seat quote. Please contact support.')
  // Replay only an explicitly submitted booking request. Opening the page alone never creates one.
  const booking = attempt.bookingRequested ? await submitBooking({ attempt, hold, createBooking }) : null
  return { hold, receivedAt, booking }
}

export async function submitBooking({ attempt, hold, createBooking, storage }) {
  if (attempt.concessionSelection && !attempt.concessionQuote) throw new Error("Review your food prices again before checkout.")
  if (storage) writeCheckout(storage, { ...attempt, bookingRequested: true })
  let booking
  try { booking = await createBooking({
    holdId: hold.holdId, requestKey: attempt.requestKey,
    priceQuoteReference: hold.priceQuote.quoteId,
    ...(attempt.concessionSelection ? { concessionSelection: attempt.concessionSelection } : {}),
  }) } catch (error) {
    if (storage && ['CONCESSION_QUOTE_CHANGED', 'INSUFFICIENT_CONCESSION_STOCK', 'INVALID_CONCESSION_SELECTION'].includes(error?.response?.data?.code)) {
      writeCheckout(storage, { ...attempt, bookingRequested: false })
    }
    throw error
  }
  if (!bookingMatchesHold(booking, hold, attempt.concessionSelection ? attempt.concessionQuote : undefined)) throw new Error('Booking details could not be verified. Please retry using this checkout.')
  return booking
}
