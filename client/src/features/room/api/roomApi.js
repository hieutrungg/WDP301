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

export const getRoomSummaryRequest = async (params, signal) => {
  const response = await httpClient.get('/rooms/summary', { params, signal })
  return response.data.data
}

export const getRoomRequest = async (roomId, signal) => {
  const response = await httpClient.get(`/rooms/${roomId}`, { signal })
  return response.data.data
}

export const createRoomRequest = async (room) => {
  const response = await httpClient.post('/rooms', room)
  return response.data.data
}

export const updateRoomRequest = async (roomId, changes) => {
  const response = await httpClient.patch(`/rooms/${roomId}`, changes)
  return response.data.data
}

export const changeRoomStatusRequest = async (roomId, status) => {
  const response = await httpClient.patch(`/rooms/${roomId}/status`, { status })
  return response.data.data
}

export const deleteRoomRequest = async (roomId) => {
  const response = await httpClient.delete(`/rooms/${roomId}`)
  return response.data.data
}
