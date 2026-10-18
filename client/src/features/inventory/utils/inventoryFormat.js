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

export const formatQuantity = (value) => new Intl.NumberFormat('en-US').format(value ?? 0)

export const itemLabel = ({ name, size }) => (size ? `${name} (${size})` : name)

const pad = (value) => String(value).padStart(2, '0')

// <input type="datetime-local"> works with local wall-clock text, not UTC.
export const toDateTimeLocalValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

export const fromDateTimeLocalValue = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
