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
