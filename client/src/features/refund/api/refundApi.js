import httpClient from '../../../lib/api/httpClient'

export const listMyRefunds = async () => (await httpClient.get('/refunds/me')).data.data
export const requestRefund = async (payload) => (await httpClient.post('/refunds', payload)).data.data
export const listManagerRefunds = async () => (await httpClient.get('/refunds/manager')).data.data
export const approveRefund = async (refundId) => (await httpClient.post(`/refunds/${refundId}/approve`)).data.data
export const retryRefund = async (refundId) => (await httpClient.post(`/refunds/${refundId}/retry`)).data.data
export const rejectRefund = async (refundId, reason) => (await httpClient.post(`/refunds/${refundId}/reject`, { reason })).data.data
export const confirmCashRefund = async (refundId) => (await httpClient.post(`/refunds/${refundId}/confirm-cash`)).data.data
