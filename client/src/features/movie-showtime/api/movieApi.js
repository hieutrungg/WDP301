import httpClient from '../../../lib/api/httpClient'

export async function getMovies(queryString, signal) {
  const response = await httpClient.get(`/movies${queryString ? `?${queryString}` : ''}`, { signal })
  return response.data
}

export async function getMovie(movieId, signal) {
  const response = await httpClient.get(`/movies/${movieId}`, { signal })
  return response.data
}
