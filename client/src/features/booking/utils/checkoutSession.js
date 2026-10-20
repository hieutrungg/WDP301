const prefix = 'fcinema:checkout:v1:'
const key = (ownerId, showtimeId) => `${prefix}${ownerId}:${showtimeId}`

export function readCheckout(storage, ownerId, showtimeId) {
  try {
    const value = JSON.parse(storage.getItem(key(ownerId, showtimeId)))
    return value?.ownerId === ownerId && value?.showtimeId === showtimeId &&
      typeof value.checkoutKey === 'string' && typeof value.requestKey === 'string' &&
      Array.isArray(value.seatIds) && value.seatIds.length > 0 &&
      value.seatIds.every((id) => typeof id === 'string') &&
      Array.isArray(value.labels) && value.labels.every((seat) =>
        typeof seat?.seatId === 'string' && typeof seat.row === 'string' &&
        ['string', 'number'].includes(typeof seat.number) && typeof seat.type === 'string') ? value : null
  } catch { return null }
}

export function writeCheckout(storage, attempt) {
  // Persist before a mutation so an interrupted response can be retried with the same key.
  storage.setItem(key(attempt.ownerId, attempt.showtimeId), JSON.stringify(attempt))
  return attempt
}

export function clearCheckout(storage, ownerId, showtimeId) {
  storage.removeItem(key(ownerId, showtimeId))
}

export function newCheckout({ ownerId, showtimeId, seats, createKey = () => crypto.randomUUID() }) {
  return {
    ownerId, showtimeId, seatIds: seats.map(({ seatId }) => seatId),
    labels: seats.map(({ seatId, row, number, type }) => ({ seatId, row, number, type })),
    checkoutKey: createKey(), requestKey: createKey(), bookingRequested: false,
  }
}

export function remainingHoldMs(hold, receivedAt, now = Date.now()) {
  const expiresAt = Date.parse(hold?.expiresAt)
  const serverNow = Date.parse(hold?.serverNow)
  if (![expiresAt, serverNow, receivedAt, now].every(Number.isFinite)) return 0
  // Wall-clock elapsed time includes background tabs and reloads; never reset the server expiry.
  return Math.max(0, expiresAt - serverNow - Math.max(0, now - receivedAt))
}

export function validHoldQuote(hold, attempt) {
  const quote = hold?.priceQuote
  if (hold?.ownerId !== attempt.ownerId || hold?.showtimeId !== attempt.showtimeId ||
      !Array.isArray(hold.seatIds) ||
      [...hold.seatIds].sort().join() !== [...attempt.seatIds].sort().join() ||
      quote?.currency !== 'VND' || !Array.isArray(quote.lines) ||
      quote.lines.length !== attempt.seatIds.length ||
      !quote.lines.every((line) => line && typeof line.seatId === 'string')) return false
  const ids = new Set(quote.lines.map(({ seatId }) => seatId))
  const total = quote.lines.reduce((sum, line) => sum + line.unitPrice, 0)
  return ids.size === attempt.seatIds.length && attempt.seatIds.every((id) => ids.has(id)) &&
    quote.lines.every(({ unitPrice }) => Number.isSafeInteger(unitPrice) && unitPrice >= 0) &&
    Number.isSafeInteger(total) && total === quote.totalAmount
}

export function bookingMatchesHold(booking, hold) {
  return typeof booking?.bookingId === 'string' && typeof booking.payableReference === 'string' &&
    ['PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED'].includes(booking.status) &&
    booking.currency === 'VND' && booking.amount === hold.priceQuote.totalAmount &&
    Number.isFinite(Date.parse(booking.expiresAt)) &&
    Date.parse(booking.expiresAt) === Date.parse(hold.expiresAt)
}

// UI handoff only. Payment must validate the payable reference and amount on its backend.
export function paymentHandoff(booking) {
  return {
    bookingId: booking.bookingId, payableReference: booking.payableReference,
    amount: booking.amount, currency: booking.currency, expiresAt: booking.expiresAt,
  }
}
