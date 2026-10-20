import httpClient from './httpClient'

export async function getPublicCinemas(params, signal) {
  const response = await httpClient.get('/cinemas', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}
