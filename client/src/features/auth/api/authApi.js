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

export const registerRequest = async (account) => {
  const payload = { ...account }
  delete payload.termsAccepted
  const response = await httpClient.post('/auth/register', payload)
  return response.data
}

export const verifyEmailRequest = async (verification) => {
  const response = await httpClient.post('/auth/verify-email', verification)
  return response.data
}

export const resendVerificationRequest = async (email) => {
  const response = await httpClient.post('/auth/resend-verification', { email })
  return response.data
}

export const googleLoginRequest = async (payload) => {
  const response = await httpClient.post('/auth/google', payload)
  return response.data
}
