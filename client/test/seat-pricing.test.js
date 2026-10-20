import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatSeatMoney, hasValidSeatPrice, sumSeatPrices } from '../src/features/seat-selection/utils/seatPricing.js'

test('missing and invalid prices cannot be presented as a free seat or a partial total', () => {
  for (const price of [undefined, null, '105000', -1, 1.5, NaN, Infinity]) {
    assert.equal(hasValidSeatPrice(price), false)
    assert.equal(formatSeatMoney(price), 'Price unavailable')
    assert.equal(sumSeatPrices([{ price: 105000 }, { price }]), null)
  }
})

test('approved Sweetbox amount is charged once per selected pair', () => {
  assert.equal(sumSeatPrices([{ price: 105000 }, { price: 236000 }]), 341000)
  assert.equal(formatSeatMoney(236000), '236.000 ₫')
})

test('explicit zero remains a valid configured price and an empty selection has zero total', () => {
  assert.equal(hasValidSeatPrice(0), true)
  assert.equal(formatSeatMoney(0), '0 ₫')
  assert.equal(sumSeatPrices([{ price: 0 }]), 0)
  assert.equal(sumSeatPrices([]), 0)
})

test('unsafe totals are rejected', () => {
  assert.equal(sumSeatPrices([{ price: Number.MAX_SAFE_INTEGER }, { price: 1 }]), null)
})
