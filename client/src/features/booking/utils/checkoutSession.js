const prefix = 'fcinema:checkout:v1:'
const key = (ownerId, showtimeId) => `${prefix}${ownerId}:${showtimeId}`

export function readCheckout(storage, ownerId, showtimeId) {
  try {
    const value = JSON.parse(storage.getItem(key(ownerId, showtimeId)))
    return value?.ownerId === ownerId && value?.showtimeId === showtimeId &&
      typeof value.checkoutKey === 'string' && typeof value.requestKey === 'string' &&
      (value.selectionDeadline === undefined || Number.isFinite(value.selectionDeadline)) &&
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

export function newCheckout({ ownerId, showtimeId, seats, selectionDeadline, createKey = () => crypto.randomUUID() }) {
  return {
    ownerId, showtimeId, seatIds: seats.map(({ seatId }) => seatId),
    labels: seats.map(({ seatId, row, number, type }) => ({ seatId, row, number, type })),
    checkoutKey: createKey(), requestKey: createKey(), bookingRequested: false,
    ...(Number.isFinite(selectionDeadline) ? { selectionDeadline } : {}),
  }
}

export function remainingHoldMs(hold, receivedAt, now = Date.now(), selectionDeadline) {
  const expiresAt = Date.parse(hold?.expiresAt)
  const serverNow = Date.parse(hold?.serverNow)
  if (![expiresAt, serverNow, receivedAt, now].every(Number.isFinite)) return 0
  // Wall-clock elapsed time includes background tabs and reloads; never reset the server expiry.
  const serverRemaining = expiresAt - serverNow - Math.max(0, now - receivedAt)
  const selectionRemaining = Number.isFinite(selectionDeadline)
    ? selectionDeadline - now
    : Number.POSITIVE_INFINITY
  return Math.max(0, Math.min(serverRemaining, selectionRemaining))
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

export function bookingMatchesHold(booking, hold, quote) {
  const discount = booking?.discountAmount ?? 0
  const validDiscount = Number.isSafeInteger(discount) && discount >= 0 && discount <= hold.priceQuote.totalAmount && (!discount || Boolean(booking.voucher))
  return typeof booking?.bookingId === 'string' && typeof booking.payableReference === 'string' &&
    validDiscount &&
    ['PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED'].includes(booking.status) &&
    booking.currency === 'VND' && (quote ? (
      quote.holdId === hold.holdId && quote.currency === 'VND' &&
      quote.ticketAmount === hold.priceQuote.totalAmount &&
      Number.isSafeInteger(quote.concessionAmount) && quote.concessionAmount >= 0 &&
      quote.amount === quote.ticketAmount + quote.concessionAmount &&
      booking.ticketAmount === quote.ticketAmount && booking.concessionAmount === quote.concessionAmount &&
      booking.amount === quote.amount - discount && booking.concessionOrder?.totalAmount === quote.concessionAmount &&
      booking.concessionOrder?.branchId === quote.branchId
    ) : booking.amount === hold.priceQuote.totalAmount - discount) &&
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
