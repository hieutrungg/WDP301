import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let vite, ReviewForm, ReviewComposer, store
before(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  const module = await vite.ssrLoadModule('/src/features/movie-showtime/components/ReviewComposer.jsx')
  ReviewForm = module.ReviewForm
  ReviewComposer = module.default
  store = (await vite.ssrLoadModule('/src/features/auth/store/authStore.js')).useAuthStore
})
after(async () => { await vite?.close() })
const form = (props = {}) => renderToStaticMarkup(createElement(ReviewForm, {
  rating: null, content: '', busy: false, error: '', setRating() {}, setContent() {}, onSubmit() {}, ...props,
}))

test('review form has a required keyboard-native radio group with five accessible choices', () => {
  const html = form({ rating: 3 })
  assert.equal((html.match(/type="radio"/g) ?? []).length, 5)
  assert.equal((html.match(/checked=""/g) ?? []).length, 1)
  for (let i = 1; i <= 5; i++) assert.ok(html.includes(`aria-label="${i} ${i === 1 ? 'star' : 'stars'}"`))
  assert.ok(html.includes('<fieldset>'))
  assert.ok(html.includes('Your rating'))
  assert.ok(html.includes('maxLength="2000"'))
  assert.ok(html.includes('Your review will be public.'))
  assert.ok(!html.includes('star-half'))
})

test('busy form disables submit and editing, and failed submission keeps content', () => {
  const content = '  Tiếng Việt\n<script>literal</script>  '
  const failed = form({ rating: 2, content, error: 'Network error' })
  assert.ok(failed.includes('role="alert"'))
  assert.ok(failed.includes('Network error'))
  assert.ok(failed.includes('  Tiếng Việt\n&lt;script&gt;literal&lt;/script&gt;  '))
  const busy = form({ busy: true, rating: 2, content })
  assert.ok(busy.includes('<fieldset disabled="">'))
  assert.ok(busy.includes('Submitting…'))
  assert.ok(/<button[^>]*disabled/.test(busy))
  assert.ok(/<button[^>]*disabled/.test(form()))
})

test('Guest and Staff do not render a fake posting form; Customer starts with server eligibility', () => {
  const original = store.getInitialState().account
  try {
    for (const account of [null, { id: 'staff', roles: [{ name: 'STAFF' }] }]) {
      store.getInitialState().account = account
      assert.equal(renderToStaticMarkup(createElement(ReviewComposer, { movieId: 'movie', onSubmitted() {} })), '')
    }
    store.getInitialState().account = { id: 'customer', roles: [{ name: 'CUSTOMER' }] }
    const html = renderToStaticMarkup(createElement(ReviewComposer, { movieId: 'movie', onSubmitted() {} }))
    assert.ok(html.includes('Checking review eligibility'))
    assert.ok(!html.includes('Publish review'))
  } finally { store.getInitialState().account = original }
})
