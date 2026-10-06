import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/\d/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a special character')

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(100, 'Full name is too long'),
    email: z.string().trim().email('Enter a valid email address').max(254),
    phone: z
      .string()
      .trim()
      .refine((value) => /^(?:\+84|0)(?:\d[\s.-]?){9,10}$/.test(value), 'Enter a valid phone number'),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username is too long')
      .regex(/^[A-Za-z0-9_]+$/, 'Use only letters, numbers, and underscores'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const verifyEmailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})
