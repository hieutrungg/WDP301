import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampLauncherPosition,
  defaultLauncherPosition,
  panelLayout,
  parseStoredPosition,
} from '../src/features/ai-assistant/utils/widgetPosition.js'

const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 700 }

test('Popo starts in the bottom-right corner', () => {
  assert.deepEqual(defaultLauncherPosition(DESKTOP), { x: 1200, y: 720 })
  assert.deepEqual(defaultLauncherPosition(PHONE), { x: 303, y: 628 })
})

test('a dragged launcher stays inside the viewport', () => {
  assert.deepEqual(clampLauncherPosition({ x: -50, y: 5000 }, DESKTOP), { x: 16, y: 728 })
  assert.deepEqual(clampLauncherPosition({ x: 600, y: 300 }, DESKTOP), { x: 600, y: 300 })
})

test('the panel opens above a low launcher and aligns with its right edge', () => {
  const panel = panelLayout({ x: 1200, y: 720 }, DESKTOP)
  assert.equal(panel.width, 400)
  assert.equal(panel.left, 1200 + 56 - 400)
  assert.equal(panel.top + panel.height, 720 - 12)
})

test('the panel opens below a launcher near the top-left and never leaves the screen', () => {
  const panel = panelLayout({ x: 16, y: 16 }, DESKTOP)
  assert.equal(panel.left, 16)
  assert.equal(panel.top, 16 + 56 + 12)
  assert.ok(panel.top + panel.height <= DESKTOP.height - 16)
})

test('on a phone the panel fits the screen width', () => {
  const panel = panelLayout({ x: 160, y: 600 }, PHONE)
  assert.equal(panel.width, 343)
  assert.ok(panel.left >= 16 && panel.left + panel.width <= PHONE.width - 16)
})

test('a broken stored position is ignored', () => {
  assert.equal(parseStoredPosition('not json'), null)
  assert.equal(parseStoredPosition('{"x":"a","y":1}'), null)
  assert.equal(parseStoredPosition(null), null)
  assert.deepEqual(parseStoredPosition('{"x":10,"y":20}'), { x: 10, y: 20 })
})
