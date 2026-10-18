import assert from 'node:assert/strict'
import test from 'node:test'
import { validateStockIn } from '../src/features/inventory/schema/stockInSchema.js'
import {
  formatQuantity,
  fromDateTimeLocalValue,
  itemLabel,
  toDateTimeLocalValue,
} from '../src/features/inventory/utils/inventoryFormat.js'

const valid = {
  lines: [{ concessionId: 'a'.repeat(24), quantity: '12' }],
  receivedAt: '2026-10-17T09:30',
  note: '',
}

test('a valid receipt passes and quantities become numbers', () => {
  const result = validateStockIn(valid)

  assert.equal(result.errors, undefined)
  assert.equal(result.value.lines[0].quantity, 12)
})

test('BR-49: quantity must be a whole number greater than zero', () => {
  for (const quantity of ['0', '-3', '1.5', '']) {
    const { errors } = validateStockIn({ ...valid, lines: [{ concessionId: 'a'.repeat(24), quantity }] })

    assert.ok(errors?.['items.0.quantity'], `quantity "${quantity}" must be rejected`)
  }
})

test('every line needs an item and an item cannot repeat', () => {
  const missing = validateStockIn({ ...valid, lines: [{ concessionId: '', quantity: '1' }] })
  assert.equal(missing.errors['items.0.concessionId'], 'Select an item')

  const duplicate = validateStockIn({
    ...valid,
    lines: [
      { concessionId: 'a'.repeat(24), quantity: '1' },
      { concessionId: 'a'.repeat(24), quantity: '2' },
    ],
  })
  assert.ok(duplicate.errors['items.1.concessionId'])
  assert.equal(duplicate.errors['items.0.concessionId'], undefined)
})

test('a receipt needs at least one line, a received date and a short note', () => {
  assert.ok(validateStockIn({ ...valid, lines: [] }).errors.items)
  assert.ok(validateStockIn({ ...valid, receivedAt: '' }).errors.receivedAt)
  assert.ok(validateStockIn({ ...valid, note: 'x'.repeat(501) }).errors.note)
})

test('date-time helpers round-trip local wall-clock values', () => {
  const local = toDateTimeLocalValue(new Date(2026, 9, 17, 9, 5))
  assert.equal(local, '2026-10-17T09:05')
  assert.equal(new Date(fromDateTimeLocalValue(local)).getHours(), 9)
  assert.equal(fromDateTimeLocalValue('not a date'), null)
})

test('display helpers format quantities and item labels', () => {
  assert.equal(formatQuantity(12500), '12,500')
  assert.equal(formatQuantity(undefined), '0')
  assert.equal(itemLabel({ name: 'Popcorn', size: 'Large' }), 'Popcorn (Large)')
  assert.equal(itemLabel({ name: 'Cola' }), 'Cola')
})
