import { z } from 'zod'

export const BRANCH_STATUSES = ['ACTIVE', 'INACTIVE']

const stripHotlineSeparators = (value) => value.replace(/[\s.()-]/g, '')

// Mirrors server/src/modules/branch/branch.validation.js; the server stays authoritative.
export const branchFormSchema = z.object({
  branchName: z
    .string()
    .trim()
    .min(2, 'Branch name must be at least 2 characters')
    .max(120, 'Branch name is too long'),
  address: z
    .string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(300, 'Address is too long'),
  email: z
    .string()
    .trim()
    .max(254, 'Email is too long')
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'Enter a valid email address',
    ),
  hotline: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?\d{4,15}$/.test(stripHotlineSeparators(value)),
      'Enter a valid hotline number (4-15 digits)',
    ),
  status: z.enum(BRANCH_STATUSES),
})

export const emptyBranchForm = {
  branchName: '',
  address: '',
  email: '',
  hotline: '',
  status: 'ACTIVE',
}

export const toBranchForm = (branch) => ({
  branchName: branch.branchName,
  address: branch.address,
  email: branch.email ?? '',
  hotline: branch.hotline ?? '',
  status: branch.status,
})
