import httpClient from '../../../lib/api/httpClient'

export async function initiatePayment({
  bookingId,
  method,
  idempotencyKey,
  amount,
  contactDetails,
}) {
  const response = await httpClient.post('/payments', {
    bookingId,
    method,
    idempotencyKey,
    ...(amount !== undefined ? { amount } : {}),
    ...(contactDetails ? { contactDetails } : {}),
  })
  return response.data.data
}

export async function listMyBookingPayments() {
  const response = await httpClient.get('/payments/me/bookings')
  return response.data.data
}

export async function getBookingPaymentDetails(bookingId) {
  const response = await httpClient.get(`/payments/bookings/${bookingId}`)
  return response.data.data
}

export async function cancelPaymentAttempt({ paymentId, attemptId, reason }) {
  const response = await httpClient.post(
    `/payments/${paymentId}/attempts/${attemptId}/cancel`,
    reason ? { reason } : {},
  )
  return response.data.data
}

export async function simulatePaymentAttempt({
  paymentId,
  attemptId,
  outcome = 'SUCCESS',
  notificationKey,
  failureReason,
}) {
  const response = await httpClient.post(
    `/payments/${paymentId}/attempts/${attemptId}/simulate`,
    {
      outcome,
      ...(notificationKey ? { notificationKey } : {}),
      ...(failureReason ? { failureReason } : {}),
    },
  )
  return response.data.data
}

// Asks the server to check a payOS bank-transfer attempt; settles it when payOS reports PAID.
export async function verifyPaymentAttempt({ paymentId, attemptId }) {
  const response = await httpClient.post(
    `/payments/${paymentId}/attempts/${attemptId}/verify`,
  )
  return response.data.data
}

export async function confirmCounterCash({ paymentId, attemptId, tenderedAmount }) {
  const response = await httpClient.post(
    `/payments/${paymentId}/attempts/${attemptId}/cash-confirm`,
    { tenderedAmount },
  )
  return response.data.data
}
