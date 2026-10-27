import httpClient from '../../../lib/api/httpClient'

export async function getRevenueReportOptions(signal) {
  const response = await httpClient.get('/reports/options', { signal })
  return response.data.data
}

export async function getRevenueReport(filters, signal) {
  const response = await httpClient.get('/reports/revenue', { params: filters, signal })
  return response.data.data
}

export async function exportRevenueReport(filters, format) {
  const response = await httpClient.get('/reports/revenue/export', {
    params: { ...filters, format },
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition'] || ''
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  const blob = new Blob([response.data], { type: response.headers['content-type'] })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || `f-cinema-revenue.${format}`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
