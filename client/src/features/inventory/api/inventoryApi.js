import httpClient from '../../../lib/api/httpClient'

export const listStockLevelsRequest = async (params, signal) => {
  const response = await httpClient.get('/inventory/stock-levels', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const getStockSummaryRequest = async (signal) => {
  const response = await httpClient.get('/inventory/stock-levels/summary', { signal })
  return response.data.data
}

export const listCategoriesRequest = async (signal) => {
  const response = await httpClient.get('/inventory/categories', { signal })
  return response.data.data
}

export const listSuppliersRequest = async (signal) => {
  const response = await httpClient.get('/inventory/suppliers', { signal })
  return response.data.data
}

export const listStockInHistoryRequest = async (params, signal) => {
  const response = await httpClient.get('/inventory/stock-in', { params, signal })
  return { items: response.data.data, meta: response.data.meta }
}

export const stockInRequest = async (receipt) => {
  const response = await httpClient.post('/inventory/stock-in', receipt)
  return response.data.data
}
