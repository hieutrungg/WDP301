import { z } from 'zod'
import { passwordRules } from '../../account/schema/accountSchemas'

export const forgotPasswordEmailSchema = z.object({
  // MSG01 / MSG03 / MSG02
  email: z
    .string()
    .trim()
    .min(1, 'The Email field is required.')
    .email('The Email format is invalid.')
    .max(254, 'Exceed max length of 254.'),
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
    message: 'Password confirmation does not match.', // MSG08
  })
