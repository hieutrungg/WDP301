import { z } from 'zod'

const MAX_LINES = 50
const MAX_QUANTITY = 100000
const NOTE_MAX_LENGTH = 500

// Mirrors the server contract for fast feedback; the server stays the authority (BR-49).
const lineSchema = z.object({
  concessionId: z.string().min(1, 'Select an item'),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity', required_error: 'Enter a quantity' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be greater than 0')
    .max(MAX_QUANTITY, `Quantity must not exceed ${MAX_QUANTITY}`),
})

const stockInFormSchema = z.object({
  lines: z.array(lineSchema).min(1, 'Add at least one item').max(MAX_LINES, `At most ${MAX_LINES} items per receipt`),
  receivedAt: z.string().min(1, 'Enter the received date and time'),
  note: z.string().max(NOTE_MAX_LENGTH, `Note must be at most ${NOTE_MAX_LENGTH} characters`),
})

// Returns { errors } keyed like the API (`items.0.quantity`, `receivedAt`, ...) or { value }.
export function validateStockIn({ lines, receivedAt, note }) {
  const parsedLines = lines.map(({ concessionId, quantity }) => ({
    concessionId,
    quantity: quantity === '' ? undefined : Number(quantity),
  }))
  const result = stockInFormSchema.safeParse({ lines: parsedLines, receivedAt, note })
  const errors = {}

  if (!result.success) {
    for (const issue of result.error.issues) {
      const [first, index, field] = issue.path
      const key = first === 'lines' && field ? `items.${index}.${field}` : first === 'lines' ? 'items' : first
      errors[key] ??= issue.message
    }
  }

  const seen = new Set()
  lines.forEach(({ concessionId }, index) => {
    if (!concessionId) return
    if (seen.has(concessionId)) errors[`items.${index}.concessionId`] ??= 'This item is already in the receipt'
    seen.add(concessionId)
  })

  return Object.keys(errors).length > 0 ? { errors } : { value: result.data }
}
