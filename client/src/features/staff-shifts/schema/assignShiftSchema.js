import { fromLocalDateTimeInput } from '../utils/staffShiftFormat.js'

// Mirrors the server rules for assigning a shift, for early feedback only; the server stays the
// authority (it also checks the branch, the employee and overlaps).
export const STATION_MAX_LENGTH = 100
export const SHIFT_MAX_HOURS = 12

const HOUR_MS = 60 * 60 * 1000

export function validateAssignShift({ employeeAccountId, station, startTime, endTime }, now = new Date()) {
  const errors = {}
  const trimmedStation = (station ?? '').trim()
  const start = fromLocalDateTimeInput(startTime)
  const end = fromLocalDateTimeInput(endTime)

  if (!employeeAccountId) errors.employeeAccountId = 'Select an employee'

  if (!trimmedStation) errors.station = 'Enter the work position'
  else if (trimmedStation.length > STATION_MAX_LENGTH) errors.station = `Use at most ${STATION_MAX_LENGTH} characters`

  if (!start) errors.startTime = 'Enter a start date and time'
  else if (new Date(start) <= now) errors.startTime = 'The shift must start in the future'

  if (!end) errors.endTime = 'Enter an end date and time'
  else if (start && new Date(end) <= new Date(start)) errors.endTime = 'End time must be after the start time'
  else if (start && new Date(end) - new Date(start) > SHIFT_MAX_HOURS * HOUR_MS) {
    errors.endTime = `A shift can last at most ${SHIFT_MAX_HOURS} hours`
  }

  if (Object.keys(errors).length > 0) return { errors }

  return { value: { employeeAccountId, station: trimmedStation, startTime: start, endTime: end } }
}
