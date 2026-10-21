// A-15: times are stored in UTC and displayed in Asia/Ho_Chi_Minh.
const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const TIME_ZONE_OFFSET = '+07:00'
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const parse = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatTime = (value) => {
  const date = parse(value)
  if (!date) return null

  return date.toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })
}

export const formatDateTime = (value) => {
  const date = parse(value)
  if (!date) return null

  return date.toLocaleString('en-GB', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Local calendar date (YYYY-MM-DD) of an instant, in the cinema's time zone.
export const localDateOf = (value = new Date()) => {
  const date = parse(value)
  if (!date) return null

  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export const isValidLocalDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export const addDays = (localDate, days) =>
  new Date(Date.parse(`${localDate}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)

export const formatDateLabel = (localDate) =>
  new Date(`${localDate}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

// <input type="datetime-local"> text ("2026-10-20T08:30") is read as cinema time, whatever the
// browser's own time zone is, and sent to the API as a UTC instant.
export const fromLocalDateTimeInput = (text) => {
  if (!DATE_TIME_INPUT_PATTERN.test(text ?? '')) return null
  return parse(`${text}:00.000${TIME_ZONE_OFFSET}`)?.toISOString() ?? null
}

export const toLocalDateTimeInput = (value) => {
  const date = parse(value)
  if (!date) return ''

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value: part }) => [type, part]),
  )

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export const formatMinutes = (minutes) => {
  const total = Math.max(0, Math.round(minutes ?? 0))
  const hours = Math.floor(total / 60)
  const rest = total % 60

  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, '0')}m`
}

export const plannedMinutes = ({ startTime, endTime }) => {
  const start = parse(startTime)
  const end = parse(endTime)
  return start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0
}

// IN_PROGRESS and COMPLETED come from the planned time window only; they say nothing about whether
// the employee actually turned up (attendance is not tracked).
export const SHIFT_STATUS_META = {
  SCHEDULED: { label: 'Scheduled', tone: 'bg-surface-container-high text-tertiary-fixed ring-white/10', dot: 'bg-tertiary' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-secondary/15 text-secondary ring-secondary/25', dot: 'bg-secondary animate-pulse' },
  COMPLETED: { label: 'Awaiting approval', tone: 'bg-primary-container/15 text-primary ring-primary/30', dot: 'bg-primary' },
  APPROVED: { label: 'Approved', tone: 'bg-surface-container-highest text-tertiary ring-white/10', dot: 'bg-tertiary' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-error-container/30 text-error ring-error/30', dot: 'bg-error' },
}

export const SHIFT_STATUS_OPTIONS = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED']

export const HISTORY_LABELS = {
  CREATED: 'Shift assigned',
  CANCELLED: 'Shift cancelled',
  APPROVED: 'Shift approved',
}

// First and last word, e.g. "Nguyen Quoc Bao" -> "NB".
export const employeeInitials = (name) => {
  const words = (name ?? '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'

  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
  return picked.map((word) => word[0].toUpperCase()).join('')
}
