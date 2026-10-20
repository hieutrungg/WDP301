import httpClient from '../../../lib/api/httpClient'

export async function createPendingBooking({ holdId, requestKey, priceQuoteReference }) {
  const response = await httpClient.post('/bookings', {
    holdId, requestKey, ...(priceQuoteReference ? { priceQuoteReference } : {}),
  })
  return response.data.data
}
