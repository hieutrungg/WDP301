import httpClient from '../../../lib/api/httpClient'
import { getMovies } from '../../movie-showtime/api/movieApi'
import { listRoomsRequest } from '../../room/api/roomApi'
import { getPublicShowtimes } from '../../movie-showtime/api/showtimeApi'

export async function getManagerScheduleData(date, signal) {
  const [showtimes, movies, rooms] = await Promise.all([
    getPublicShowtimes({ date, limit: 50 }, signal),
    getMovies('limit=24', signal),
    listRoomsRequest({ limit: 200 }, signal),
  ])

  return {
    showtimes: showtimes.items,
    movies: movies.data ?? [],
    rooms: rooms.items,
  }
}

export async function createManagerShowtime(payload) {
  const response = await httpClient.post('/showtimes', payload)
  return response.data.data
}

export async function rescheduleManagerShowtime(showtimeId, payload) {
  const response = await httpClient.patch(`/showtimes/${showtimeId}`, payload)
  return response.data.data
}

export async function cancelManagerShowtime(showtimeId) {
  const response = await httpClient.post(`/showtimes/${showtimeId}/cancel`)
  return response.data.data
}
