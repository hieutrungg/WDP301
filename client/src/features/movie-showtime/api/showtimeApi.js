import httpClient from '../../../lib/api/httpClient'
import { getMovie } from './movieApi'

export async function getPublicCinemas(params, signal) {
  const response = await httpClient.get('/cinemas', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export async function getPublicShowtimes(params, signal) {
  const { movieId, ...query } = params
  const path = movieId ? `/movies/${movieId}/showtimes` : '/showtimes'
  const response = await httpClient.get(path, { params: query, signal })
  return { items: response.data.data, meta: response.data.meta }
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
