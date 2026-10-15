import httpClient from '../../../lib/api/httpClient'

export const listRoomsRequest = async (params, signal) => {
  const response = await httpClient.get('/rooms', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getSeatLayoutRequest = async (roomId, signal) => {
  const response = await httpClient.get(`/rooms/${roomId}/seat-layout`, { signal })
  return response.data.data
}

export const createSeatLayoutRequest = async (roomId, layout) => {
  const response = await httpClient.post(`/rooms/${roomId}/seat-layout`, layout)
  return response.data.data
}

export const updateSeatLayoutRequest = async (roomId, layout) => {
  const response = await httpClient.put(`/rooms/${roomId}/seat-layout`, layout)
  return response.data.data
}
