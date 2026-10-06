import httpClient from '../../../lib/api/httpClient'

export const loginRequest = async (credentials) => {
  const response = await httpClient.post('/auth/login', credentials)
  return response.data
}

export const getCurrentAccountRequest = async () => {
  const response = await httpClient.get('/auth/me')
  return response.data.data
}

export const logoutRequest = async () => {
  const response = await httpClient.post('/auth/logout')
  return response.data
}
