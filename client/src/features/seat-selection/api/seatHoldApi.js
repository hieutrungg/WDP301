import httpClient from '../../../lib/api/httpClient'

export async function getSeatAvailability(showtimeId, signal) {
  const response = await httpClient.get(`/showtimes/${showtimeId}/seats`, { signal })
  return response.data.data
}

export async function acquireSeatHold({ showtimeId, seatIds, checkoutKey }) {
  const response = await httpClient.post('/seat-holds', { showtimeId, seatIds, checkoutKey })
  return response.data.data
}

export async function releaseSeatHold(holdId) {
  const response = await httpClient.delete(`/seat-holds/${holdId}`)
  return response.data.data
}

