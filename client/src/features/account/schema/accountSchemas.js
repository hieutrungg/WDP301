import { z } from 'zod'

// Same rules the server enforces; also drives the live checklist on Change Password.
export const passwordRules = [
  { id: 'length', label: 'At least 8 characters in length', short: 'more characters', test: (value) => value.length >= 8 },
  { id: 'upper', label: 'At least one uppercase letter (A-Z)', short: 'uppercase letters', test: (value) => /[A-Z]/.test(value) },
  { id: 'lower', label: 'At least one lowercase letter (a-z)', short: 'lowercase letters', test: (value) => /[a-z]/.test(value) },
  { id: 'number', label: 'At least one numeric digit (0-9)', short: 'numbers', test: (value) => /\d/.test(value) },
  { id: 'special', label: 'At least one special character (!@#$%^&*)', short: 'special characters', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

const newPasswordSchema = z
  .string()
  .max(128, 'Password is too long')
  .refine(
    (value) => passwordRules.every((rule) => rule.test(value)),
    'New password does not meet password requirements.',
  )

export const editProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^(?:\+84|0)(?:\d[\s.-]?){9,10}$/.test(value),
      'Please enter a valid mobile phone number (e.g., 0912 345 678 or +84 912 345 678).',
    ),
})

// `method` is whichever proof of ownership the user picked: the current password or Google.
export const changePasswordSchema = z
  .object({
    method: z.enum(['password', 'google']),
    currentPassword: z.string().max(128, 'Password is too long'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .superRefine((values, context) => {
    if (values.method === 'password' && !values.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Please enter your current password.',
      })
    }

    if (values.confirmPassword && values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Password confirmation does not match. Please ensure both passwords are identical.',
      })
    }
  })
