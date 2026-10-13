import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMovieQuery,
  getVisibleMoviePages,
  MOVIE_PAGE_SIZE,
  readMovieSearchParams,
} from '../src/features/movie-showtime/utils/movieSearchParams.js'

test('movie search parameters are trimmed and converted to an API query', () => {
  const state = readMovieSearchParams(
    new URLSearchParams('q=%20Aurora%20&genre=Drama&page=2&sort=title-asc'),
  )

  assert.deepEqual(state, {
    q: 'Aurora',
    genre: 'Drama',
    page: 2,
    sort: 'title',
    order: 'asc',
    sortOption: 'title-asc',
  })

  const query = new URLSearchParams(buildMovieQuery(state))
  assert.equal(query.get('q'), 'Aurora')
  assert.equal(query.get('genre'), 'Drama')
  assert.equal(query.get('page'), '2')
  assert.equal(query.get('limit'), String(MOVIE_PAGE_SIZE))
  assert.equal(query.get('sort'), 'title')
  assert.equal(query.get('order'), 'asc')
})

test('invalid page and sort values fall back to safe defaults', () => {
  const state = readMovieSearchParams(
    new URLSearchParams('page=-3&sort=unknown&order=unknown'),
  )

  assert.equal(state.page, 1)
  assert.equal(state.sortOption, 'releaseDate-desc')
  assert.equal(state.sort, 'releaseDate')
  assert.equal(state.order, 'desc')
})

test('visible pagination stays inside the available page range', () => {
  assert.deepEqual(getVisibleMoviePages(1, 8), [1, 2, 3, 4, 5])
  assert.deepEqual(getVisibleMoviePages(4, 8), [2, 3, 4, 5, 6])
  assert.deepEqual(getVisibleMoviePages(8, 8), [4, 5, 6, 7, 8])
  assert.deepEqual(getVisibleMoviePages(1, 0), [])
})
