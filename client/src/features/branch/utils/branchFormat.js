// Hotlines are stored as digits only; group them for reading without changing the value.
export const formatHotline = (hotline) => {
  if (!hotline) return null
  if (/^1[89]00\d{4}$/.test(hotline)) return `${hotline.slice(0, 4)} ${hotline.slice(4)}`
  if (/^0\d{9,10}$/.test(hotline)) {
    return `${hotline.slice(0, 3)} ${hotline.slice(3, 7)} ${hotline.slice(7)}`
  }
  return hotline
}

// A-15: display times in Asia/Ho_Chi_Minh.
export const formatDateTime = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getApiErrorCode = (error) => error?.response?.data?.code
