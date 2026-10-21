import httpClient from '../../../lib/api/httpClient'

export async function createMovie(input) {
  const response = await httpClient.post('/movies', input)
  return response.data.data
}

export async function listManagerMovies(params, { signal } = {}) {
  const response = await httpClient.get('/movies/manage', { params, signal })
  return response.data
}

export async function getMovieForManagement(movieId, { signal } = {}) {
  const response = await httpClient.get(`/movies/${encodeURIComponent(movieId)}/manage`, { signal })
  return response.data.data
}

export async function updateMovie(movieId, input, { signal } = {}) {
  const response = await httpClient.patch(`/movies/${encodeURIComponent(movieId)}`, input, { signal })
  return response.data.data
}
