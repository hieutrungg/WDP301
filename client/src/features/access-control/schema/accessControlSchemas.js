import { z } from 'zod'

// Format checks pass on an empty value so a blank field reports only MSG01.
const ifPresent = (check) => (value) => !value || check(value)

// SRS 5.3 field messages (MSG01 required, MSG02 max length, MSG03 format). The server applies the
// same rules; these only give early feedback next to the field (CR-04).
const required = (label) => `The ${label} field is required.`
const maxLength = (max) => `Exceed max length of ${max}.`
const invalid = (label) => `The ${label} format is invalid.`

const text = (label, { min = 1, max }) =>
  z
    .string()
    .trim()
    .min(1, required(label))
    .max(max, maxLength(max))
    .refine((value) => !value || value.length >= min, `The ${label} must be at least ${min} characters.`)

const fullName = text('Full name', { min: 2, max: 100 })
const email = text('Email', { max: 254 }).refine(
  ifPresent((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  invalid('Email'),
)
const username = text('Username', { min: 3, max: 30 }).refine(
  ifPresent((value) => /^[A-Za-z0-9_]+$/.test(value)),
  invalid('Username'),
)
const phone = text('Phone number', { max: 20 }).refine(
  ifPresent((value) => /^(?:\+84|0)\d{9,10}$/.test(value.replace(/[\s.-]/g, ''))),
  invalid('Phone number'),
)
const position = z.string().trim().max(60, maxLength(60))

export const ROLE_REQUIRED_MESSAGE = 'At least one role is required.'

export const staffProfileSchema = z.object({
  fullName,
  email,
  phone,
  branchId: z.string(),
  position,
})

export const createStaffSchema = staffProfileSchema.extend({
  username,
  roleIds: z.array(z.string()).min(1, ROLE_REQUIRED_MESSAGE),
  directPermissionIds: z.array(z.string()),
})

export const emptyStaffForm = {
  fullName: '',
  email: '',
  username: '',
  phone: '',
  branchId: '',
  position: '',
  roleIds: [],
  directPermissionIds: [],
}

export function toStaffProfileForm(account) {
  return {
    fullName: account.fullName ?? '',
    email: account.email ?? '',
    phone: account.phone ?? '',
    branchId: account.branch?.id ?? '',
    position: account.position ?? '',
  }
}

export const roleInfoSchema = z.object({
  name: text('Role name', { min: 2, max: 50 }).refine(
    ifPresent((value) => /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(value)),
    invalid('Role name'),
  ),
  description: z.string().trim().max(200, maxLength(200)),
})

export function toRoleForm(role) {
  return { name: role?.name ?? '', description: role?.description ?? '' }
}
