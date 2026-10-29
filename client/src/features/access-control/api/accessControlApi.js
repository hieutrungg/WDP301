import httpClient from '../../../lib/api/httpClient'

// ---- Roles & permissions (UC45-47) ----
export const listPermissionsRequest = async () => {
  const response = await httpClient.get('/permissions')
  return response.data.data
}

export const listRolesRequest = async (params, signal) => {
  const response = await httpClient.get('/roles', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getRoleRequest = async (roleId) => {
  const response = await httpClient.get(`/roles/${roleId}`)
  return response.data.data
}

export const createRoleRequest = async (payload) => {
  const response = await httpClient.post('/roles', payload)
  return { role: response.data.data, message: response.data.message }
}

export const updateRoleRequest = async (roleId, payload) => {
  const response = await httpClient.patch(`/roles/${roleId}`, payload)
  return { role: response.data.data, message: response.data.message }
}

export const assignRolePermissionsRequest = async (roleId, payload) => {
  const response = await httpClient.put(`/roles/${roleId}/permissions`, payload)
  return { role: response.data.data, message: response.data.message }
}

// ---- Staff accounts (UC35-37) ----
export const listStaffAccountsRequest = async (params, signal) => {
  const response = await httpClient.get('/staff-accounts', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getStaffFormOptionsRequest = async () => {
  const response = await httpClient.get('/staff-accounts/options')
  return response.data.data
}

export const getStaffAccountRequest = async (accountId) => {
  const response = await httpClient.get(`/staff-accounts/${accountId}`)
  return response.data.data
}

export const createStaffAccountRequest = async (payload) => {
  const response = await httpClient.post('/staff-accounts', payload)
  return {
    account: response.data.data,
    message: response.data.message,
    credentialSetup: response.data.meta?.credentialSetup ?? null,
  }
}

export const updateStaffAccountRequest = async (accountId, payload) => {
  const response = await httpClient.patch(`/staff-accounts/${accountId}`, payload)
  return { account: response.data.data, message: response.data.message }
}

export const changeStaffStatusRequest = async (accountId, status) => {
  const response = await httpClient.patch(`/staff-accounts/${accountId}/status`, { status })
  return { account: response.data.data, message: response.data.message }
}

export const assignStaffAccessRequest = async (accountId, payload) => {
  const response = await httpClient.put(`/staff-accounts/${accountId}/access`, payload)
  return { account: response.data.data, message: response.data.message }
}
