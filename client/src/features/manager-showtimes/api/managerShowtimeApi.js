import httpClient from '../../../lib/api/httpClient'
import { getMovies } from '../../movie-showtime/api/movieApi'
import { listRoomsRequest } from '../../room/api/roomApi'

export async function getManagerScheduleData({ date, view, cinemaId, query, page }, signal) {
  const getParams = (requestedDate, requestedPage = page) => {
    const params = new URLSearchParams({ view, page: String(requestedPage), limit: '50' })
    if (requestedDate) params.set('date', requestedDate)
    if (cinemaId) params.set('cinemaId', cinemaId)
    if (query.trim()) params.set('q', query.trim())
    return params
  }
  const requestedDates = view === 'schedule' && date ? getWeekDates(date) : [date]

  const [showtimesResponses, movies, rooms] = await Promise.all([
    Promise.all(requestedDates.map((requestedDate) =>
      httpClient.get(`/showtimes/manage?${getParams(requestedDate, view === 'schedule' ? 1 : page)}`, { signal }),
    )),
    getMovies('limit=24', signal),
    listRoomsRequest({ limit: 200 }, signal),
  ])

  const showtimes = showtimesResponses.flatMap((response) => response.data.data)
  const meta = view === 'schedule'
    ? { total: showtimesResponses.reduce((sum, response) => sum + (response.data.meta?.total ?? response.data.data.length), 0), totalPages: 1, page: 1 }
    : showtimesResponses[0].data.meta

  return {
    showtimes,
    meta,
    movies: movies.data ?? [],
    rooms: rooms.items,
  }
}

function getWeekDates(date) {
  const [year, month, day] = date.split('-').map(Number)
  const selectedDay = new Date(Date.UTC(year, month - 1, day, 12))
  const mondayOffset = (selectedDay.getUTCDay() + 6) % 7
  selectedDay.setUTCDate(selectedDay.getUTCDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, index) => {
    const weekDay = new Date(selectedDay)
    weekDay.setUTCDate(selectedDay.getUTCDate() + index)
    return `${weekDay.getUTCFullYear()}-${String(weekDay.getUTCMonth() + 1).padStart(2, '0')}-${String(weekDay.getUTCDate()).padStart(2, '0')}`
  })
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
