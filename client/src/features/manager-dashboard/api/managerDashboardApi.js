import httpClient from '../../../lib/api/httpClient'

export async function getManagerDashboard(period, signal) {
  const response = await httpClient.get('/analytics/dashboard', { params: { period }, signal })
  return response.data.data
}
