import httpClient from '../../../lib/api/httpClient'

export async function getBookingTickets(bookingId) {
  const response = await httpClient.get(`/tickets/bookings/${bookingId}`)
  return response.data.data
}

export async function getTicket(ticketId) {
  const response = await httpClient.get(`/tickets/${ticketId}`)
  return response.data.data
}
