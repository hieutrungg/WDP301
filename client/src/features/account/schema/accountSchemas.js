import { z } from 'zod'

const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/\d/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a special character')

export const editProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100, 'Full name is too long'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^(?:\+84|0)(?:\d[\s.-]?){9,10}$/.test(value),
      'Enter a valid phone number',
    ),
})

// `method` is whichever proof of ownership the user picked: the current password or Google.
export const changePasswordSchema = z
  .object({
    method: z.enum(['password', 'google']),
    currentPassword: z.string().max(128, 'Password is too long'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .superRefine((values, context) => {
    if (values.method === 'password' && !values.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Enter your current password',
      })
    }

    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      })
    }
  })
