import httpClient from '../../../lib/api/httpClient'

// The branch is never sent: the API takes it from the logged-in Manager's employee profile.

export const getShiftDashboardRequest = async (signal) => {
  const response = await httpClient.get('/staff-shifts/dashboard', { signal })
  return response.data.data
}

export const listShiftsRequest = async (params, signal) => {
  const response = await httpClient.get('/staff-shifts', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getShiftRequest = async (shiftId, signal) => {
  const response = await httpClient.get(`/staff-shifts/${shiftId}`, { signal })
  return response.data.data
}

export const listStationsRequest = async (signal) => {
  const response = await httpClient.get('/staff-shifts/stations', { signal })
  return response.data.data
}

export const listEmployeesRequest = async (q, signal) => {
  const response = await httpClient.get('/staff-shifts/employees', { params: { q: q || undefined }, signal })
  return response.data.data
}

export const createShiftRequest = async (shift) => {
  const response = await httpClient.post('/staff-shifts', shift)
  return response.data.data
}

export const cancelShiftRequest = async (shiftId) => {
  const response = await httpClient.post(`/staff-shifts/${shiftId}/cancel`)
  return response.data.data
}

export const approveShiftRequest = async (shiftId, note) => {
  const response = await httpClient.post(`/staff-shifts/${shiftId}/approve`, note ? { note } : {})
  return response.data.data
}
