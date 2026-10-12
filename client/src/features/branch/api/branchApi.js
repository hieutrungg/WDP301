import httpClient from '../../../lib/api/httpClient'

export const listBranchesRequest = async (params, signal) => {
  const response = await httpClient.get('/branches', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getBranchSummaryRequest = async (signal) => {
  const response = await httpClient.get('/branches/summary', { signal })
  return response.data.data
}

export const getBranchRequest = async (branchId, signal) => {
  const response = await httpClient.get(`/branches/${branchId}`, { signal })
  return response.data.data
}

export const createBranchRequest = async (branch) => {
  const response = await httpClient.post('/branches', branch)
  return response.data.data
}

export const updateBranchRequest = async (branchId, changes) => {
  const response = await httpClient.patch(`/branches/${branchId}`, changes)
  return response.data.data
}

export const changeBranchStatusRequest = async (branchId, status) => {
  const response = await httpClient.patch(`/branches/${branchId}/status`, { status })
  return response.data.data
}
