import assert from 'node:assert/strict'
import test from 'node:test'
import { validateAssignShift } from '../src/features/staff-shifts/schema/assignShiftSchema.js'
import {
  SHIFT_STATUS_META,
  SHIFT_STATUS_OPTIONS,
  addDays,
  employeeInitials,
  formatMinutes,
  formatTime,
  fromLocalDateTimeInput,
  isValidLocalDate,
  localDateOf,
  plannedMinutes,
  toLocalDateTimeInput,
} from '../src/features/staff-shifts/utils/staffShiftFormat.js'

test('times are shown in Asia/Ho_Chi_Minh (UTC+7)', () => {
  assert.equal(formatTime('2026-10-20T01:30:00.000Z'), '08:30')
  assert.equal(formatTime(null), null)
  assert.equal(formatTime('not a date'), null)
})

test('the local date flips at midnight in Ho Chi Minh, not UTC', () => {
  assert.equal(localDateOf('2026-10-19T16:59:59.000Z'), '2026-10-19')
  assert.equal(localDateOf('2026-10-19T17:00:00.000Z'), '2026-10-20')
})

test('date arithmetic works on calendar dates', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('only real calendar dates are valid', () => {
  assert.equal(isValidLocalDate('2026-10-20'), true)
  assert.equal(isValidLocalDate('2026-02-30'), false)
  assert.equal(isValidLocalDate('20261020'), false)
  assert.equal(isValidLocalDate(undefined), false)
})

test('datetime-local text is read and written as cinema time, whatever the browser time zone', () => {
  assert.equal(fromLocalDateTimeInput('2026-10-20T08:30'), '2026-10-20T01:30:00.000Z')
  assert.equal(toLocalDateTimeInput('2026-10-20T01:30:00.000Z'), '2026-10-20T08:30')
  assert.equal(toLocalDateTimeInput('2026-10-19T17:00:00.000Z'), '2026-10-20T00:00', 'midnight is 00:00, not 24:00')
  assert.equal(fromLocalDateTimeInput(toLocalDateTimeInput('2026-10-20T01:30:00.000Z')), '2026-10-20T01:30:00.000Z')
  assert.equal(fromLocalDateTimeInput(''), null)
  assert.equal(fromLocalDateTimeInput('2026-10-20'), null)
  assert.equal(toLocalDateTimeInput(null), '')
})

test('minutes are formatted as hours and minutes', () => {
  assert.equal(formatMinutes(5), '5m')
  assert.equal(formatMinutes(60), '1h')
  assert.equal(formatMinutes(65), '1h 05m')
})

test('planned duration and initials', () => {
  assert.equal(plannedMinutes({ startTime: '2026-10-20T01:00:00.000Z', endTime: '2026-10-20T09:00:00.000Z' }), 480)
  assert.equal(employeeInitials('Nguyen Quoc Bao'), 'NB')
  assert.equal(employeeInitials('Prince'), 'P')
  assert.equal(employeeInitials(undefined), '?')
})

test('every lifecycle status has display metadata, and no attendance status exists', () => {
  assert.deepEqual(SHIFT_STATUS_OPTIONS, ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED'])
  for (const status of SHIFT_STATUS_OPTIONS) assert.ok(SHIFT_STATUS_META[status].label, status)
  assert.equal('ABSENT' in SHIFT_STATUS_META, false)
})

const NOW = new Date('2026-10-20T00:00:00.000Z')
const valid = {
  employeeAccountId: 'a'.repeat(24),
  station: '  Box Office Station 2 ',
  startTime: '2026-10-21T08:00',
  endTime: '2026-10-21T16:00',
}

test('a valid assignment passes and is converted to UTC instants with a trimmed position', () => {
  const result = validateAssignShift(valid, NOW)

  assert.equal(result.errors, undefined)
  assert.deepEqual(result.value, {
    employeeAccountId: 'a'.repeat(24),
    station: 'Box Office Station 2',
    startTime: '2026-10-21T01:00:00.000Z',
    endTime: '2026-10-21T09:00:00.000Z',
  })
})

test('an assignment needs an employee, a position and a sensible time window', () => {
  assert.ok(validateAssignShift({ ...valid, employeeAccountId: '' }, NOW).errors.employeeAccountId)
  assert.ok(validateAssignShift({ ...valid, station: '   ' }, NOW).errors.station)
  assert.ok(validateAssignShift({ ...valid, station: 'x'.repeat(101) }, NOW).errors.station)
  assert.ok(validateAssignShift({ ...valid, startTime: '' }, NOW).errors.startTime)
  assert.ok(validateAssignShift({ ...valid, startTime: '2026-10-19T08:00' }, NOW).errors.startTime, 'in the past')
  assert.ok(validateAssignShift({ ...valid, endTime: '2026-10-21T07:00' }, NOW).errors.endTime, 'before the start')
  assert.ok(validateAssignShift({ ...valid, endTime: '2026-10-21T21:00' }, NOW).errors.endTime, 'longer than 12 hours')
  assert.equal(validateAssignShift({ ...valid, endTime: '2026-10-21T20:00' }, NOW).errors, undefined, 'exactly 12 hours')
})
