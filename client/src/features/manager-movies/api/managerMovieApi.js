import httpClient from '../../../lib/api/httpClient'

export async function createMovie(input) {
  const response = await httpClient.post('/movies', input)
  return response.data.data
}
