import httpClient from '../../../lib/api/httpClient'

export async function createPendingBooking({ holdId, requestKey, priceQuoteReference, concessionSelection }) {
  const response = await httpClient.post('/bookings', {
    holdId, requestKey, ...(concessionSelection ? { concessionSelection } : {}), ...(priceQuoteReference ? { priceQuoteReference } : {}),
  })
  return response.data.data
}

export async function quoteConcessions(command) {
  const { data } = await httpClient.post('/concession-checkout/quote', command)
  return data.data
}
export async function cancelCheckout(bookingId) {
  const { data } = await httpClient.post('/bookings/' + bookingId + '/cancel-checkout', {})
  return data.data
}
