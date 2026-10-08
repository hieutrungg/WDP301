import httpClient from '../../../lib/api/httpClient'

export const updateProfileRequest = async (changes) => {
  const response = await httpClient.patch('/accounts/me', changes)
  return response.data.data
}

export const changePasswordRequest = async (payload) => {
  const response = await httpClient.post('/accounts/me/password', payload)
  return response.data
}
