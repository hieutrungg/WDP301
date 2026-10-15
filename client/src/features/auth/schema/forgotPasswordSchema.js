import { z } from 'zod'
import { passwordRules } from '../../account/schema/accountSchemas'

export const forgotPasswordEmailSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address').max(254),
})

export const resetOtpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})

export const newPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .max(128, 'Password is too long')
      .refine(
        (value) => passwordRules.every((rule) => rule.test(value)),
        'New password does not meet password requirements.',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
