import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let vite, ReviewStars, MovieReviewsView
before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  ReviewStars = (await vite.ssrLoadModule('/src/features/movie-showtime/components/ReviewStars.jsx')).default
  ;({ MovieReviewsView } = await vite.ssrLoadModule('/src/features/movie-showtime/components/MovieReviews.jsx'))
})
after(async () => { await vite?.close() })

test('each integer rating has exactly five read-only stars, correct colors, accessible name and no score text', () => {
  for (let rating = 1; rating <= 5; rating++) {
    const html = renderToStaticMarkup(createElement(ReviewStars, { rating }))
    assert.equal((html.match(/<svg/g) ?? []).length, 5)
    assert.equal((html.match(/text-secondary/g) ?? []).length, rating)
    assert.equal((html.match(/text-\[#71737d\]/g) ?? []).length, 5 - rating)
    assert.ok(html.includes(`aria-label="${rating} out of 5 stars"`))
    assert.equal(html.replace(/<[^>]*>/g, ''), '')
    assert.ok(!/<button|<input|tabindex|star-half/.test(html))
  }
  for (const rating of [undefined, null, '3', 0, 6, 2.5]) {
    assert.equal(renderToStaticMarkup(createElement(ReviewStars, { rating })), '')
  }
})

const defaults = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
  page: 1, loading: false, error: false, retry() {}, setPage() {} }
const render = props => renderToStaticMarkup(createElement(MovieReviewsView, { ...defaults, ...props }))

test('loading, error/retry and empty states are distinct and have no write CTA or movie statistics', () => {
  const loading = render({ loading: true })
  assert.ok(loading.includes('role="status"'))
  assert.ok(loading.includes('Loading reviews'))
  assert.ok(!loading.includes('No reviews yet'))
  const error = render({ error: true })
  assert.ok(error.includes('Try again'))
  assert.ok(!error.includes('No reviews yet'))
  assert.ok(render({}).includes('No reviews yet'))
  for (const html of [loading, error, render({})]) {
    assert.ok(!/Write a review|Post review|Average|total reviews|\/5/.test(html.replace(/<[^>]*>/g, '')))
  }
})

test('review content is escaped without changing its language; date is semantic; pagination exposes no review total', () => {
  const html = render({ data: [{ id: 'test', authorDisplayName: '<private-name>', rating: 3,
    content: 'Tiếng Việt\n<script>alert(1)</script>', createdAt: '2026-10-26T23:30:00Z' }],
    meta: { page: 1, limit: 10, total: 123, totalPages: 13 } })
  assert.ok(html.includes('&lt;private-name&gt;'))
  assert.ok(html.includes('Tiếng Việt\n&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(html.includes('<time dateTime="2026-10-26T23:30:00Z"'))
  assert.ok(html.includes('27 October 2026'))
  assert.ok(html.includes('Review pagination'))
  assert.ok(html.includes('Page 1'))
  const visibleText = html.replace(/<[^>]*>/g, '')
  assert.ok(!visibleText.includes('123'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!visibleText.includes('3/5'))
  assert.ok(!visibleText.includes('3.0'))
})

test('a page made empty by concurrent changes still offers navigation back', () => {
  const html = render({ page: 3 })
  assert.ok(html.includes('No reviews yet'))
  assert.ok(html.includes('Previous'))
  assert.ok(html.includes('Next'))
})
