import { z } from 'zod'

export const ROOM_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE']

// Labels offered as suggestions only; the server accepts any short label (schema doc: 2D, 3D, IMAX).
export const ROOM_TYPE_SUGGESTIONS = ['STANDARD', '2D', '3D', 'IMAX']

// The approved ticket price policy covers adult 2D only (ticket-pricing service), so a showtime
// can only be published in a room of one of these types.
export const PRICED_ROOM_TYPES = ['STANDARD', '2D']

export const normalizeRoomType = (value) => value.trim().replace(/\s+/g, ' ').toUpperCase()

// Mirrors server/src/modules/room/room.validation.js; the server stays authoritative.
export const roomFormSchema = z.object({
  branchId: z.string().regex(/^[a-f\d]{24}$/i, 'Select a branch'),
  roomName: z.string().trim().min(1, 'Room name is required').max(60, 'Room name is too long'),
  roomType: z
    .string()
    .trim()
    .refine(
      (value) => /^[A-Z0-9][A-Z0-9 _.+-]{0,29}$/.test(normalizeRoomType(value)),
      'Room type must be 1-30 letters, digits or spaces',
    ),
  status: z.enum(ROOM_STATUSES),
})

export const emptyRoomForm = { branchId: '', roomName: '', roomType: 'STANDARD', status: 'ACTIVE' }

export const toRoomForm = (room) => ({
  branchId: room.branch.id ?? '',
  roomName: room.roomName,
  roomType: room.roomType ?? '',
  status: room.status ?? 'ACTIVE',
})
