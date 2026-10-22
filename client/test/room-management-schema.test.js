import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRICED_ROOM_TYPES,
  emptyRoomForm,
  normalizeRoomType,
  roomFormSchema,
  toRoomForm,
} from '../src/features/room/schema/roomSchema.js'
import { formatCount, pluralize } from '../src/features/room/utils/roomFormat.js'

const branchId = 'a'.repeat(24)
const valid = { branchId, roomName: 'Room 01', roomType: 'STANDARD', status: 'ACTIVE' }

test('a complete room form passes', () => {
  assert.equal(roomFormSchema.safeParse(valid).success, true)
})

test('the empty create form is not submittable until a branch and name are given', () => {
  const result = roomFormSchema.safeParse(emptyRoomForm)

  assert.equal(result.success, false)
  const fields = result.error.issues.map(({ path }) => path[0])
  assert.ok(fields.includes('branchId'))
  assert.ok(fields.includes('roomName'))
})

test('rejects a blank or oversized name and an invalid branch id', () => {
  assert.equal(roomFormSchema.safeParse({ ...valid, roomName: '   ' }).success, false)
  assert.equal(roomFormSchema.safeParse({ ...valid, roomName: 'x'.repeat(61) }).success, false)
  assert.equal(roomFormSchema.safeParse({ ...valid, branchId: 'nope' }).success, false)
})

test('room types are normalized like the server does', () => {
  assert.equal(normalizeRoomType('  imax   laser '), 'IMAX LASER')
  assert.equal(roomFormSchema.safeParse({ ...valid, roomType: ' imax ' }).success, true)
  assert.equal(roomFormSchema.safeParse({ ...valid, roomType: '' }).success, false)
  assert.equal(roomFormSchema.safeParse({ ...valid, roomType: '?!' }).success, false)
  assert.equal(roomFormSchema.safeParse({ ...valid, roomType: 'x'.repeat(31) }).success, false)
})

test('status must be one of the room lifecycle states', () => {
  for (const status of ['ACTIVE', 'MAINTENANCE', 'INACTIVE']) {
    assert.equal(roomFormSchema.safeParse({ ...valid, status }).success, true, status)
  }
  assert.equal(roomFormSchema.safeParse({ ...valid, status: 'AVAILABLE' }).success, false)
})

test('only STANDARD and 2D rooms have an approved price policy', () => {
  assert.deepEqual(PRICED_ROOM_TYPES, ['STANDARD', '2D'])
})

test('toRoomForm maps a room to editable values and tolerates missing fields', () => {
  assert.deepEqual(
    toRoomForm({ branch: { id: branchId }, roomName: 'Room 02', roomType: '3D', status: 'MAINTENANCE' }),
    { branchId, roomName: 'Room 02', roomType: '3D', status: 'MAINTENANCE' },
  )
  assert.deepEqual(toRoomForm({ branch: { id: null }, roomName: 'Legacy', roomType: null, status: null }), {
    branchId: '',
    roomName: 'Legacy',
    roomType: '',
    status: 'ACTIVE',
  })
})

test('count helpers', () => {
  assert.equal(formatCount(1842), '1,842')
  assert.equal(formatCount(undefined), '0')
  assert.equal(pluralize(1, 'showtime'), '1 showtime')
  assert.equal(pluralize(3, 'showtime'), '3 showtimes')
})
