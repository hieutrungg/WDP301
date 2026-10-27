import httpClient from '../../../lib/api/httpClient'
import { getPublicCinemas } from '../../../lib/api/publicCinemaApi'
import { getMovie } from './movieApi'

export { getPublicCinemas }

export async function getPublicShowtimes(params, signal) {
  const { movieId, ...query } = params
  const path = movieId ? `/movies/${movieId}/showtimes` : '/showtimes'
  const firstPage = await httpClient.get(path, { params: { ...query, page: 1 }, signal })
  const totalPages = firstPage.data.meta?.totalPages ?? 1
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
      httpClient.get(path, { params: { ...query, page: index + 2 }, signal }),
    ),
  )
  return {
    items: [firstPage, ...rest].flatMap((response) => response.data.data ?? []),
    meta: firstPage.data.meta,
  }
}

export async function getPublicShowtime(showtimeId, signal) {
  const response = await httpClient.get(`/showtimes/${showtimeId}`, { signal })
  return response.data.data
}

export async function getMovieWithShowtimes(movieId, signal) {
  if (!movieId) return null
  const response = await getMovie(movieId, signal)
  return response.data.data
}
