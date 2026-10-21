import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCreateMovieInput, buildMoviePatch, initialMovieForm, movieFieldErrors, movieRequestError, movieToForm, validateMovieForm } from '../src/features/manager-movies/utils/movieForm.js'

const original = {
  id: 'a'.repeat(24), title: 'The Film', synopsis: 'Original synopsis', genres: ['Drama', 'Mystery'],
  cast: ['Doe, Jane', 'Actor Two'], duration: 121, releaseDate: '2026-10-21T00:00:00.000Z',
  language: 'Vietnamese', director: 'Director Name', ageRating: 'Legacy rating',
  posterUrl: 'https://example.com/poster.jpg', trailerUrl: 'https://example.com/trailer',
  status: 'DRAFT', releaseYear: 2026, updatedAt: '2026-10-21T07:00:00.000Z',
}

test('management preload preserves genres and legacy age rating and formats the stored UTC release day', () => {
  const form = movieToForm(original)
  assert.equal(form.releaseDate, '2026-10-21')
  assert.equal(form.duration, '121')
  assert.equal(form.ageRating, 'Legacy rating')
  assert.deepEqual(form.genres, ['Drama', 'Mystery'])
  assert.notEqual(form.genres, original.genres)
  assert.equal(form.cast, 'Doe, Jane, Actor Two')
  assert.equal(form.status, undefined)
  assert.equal(form.releaseYear, undefined)
})

test('a pristine form has no PATCH and unrelated edits never rewrite cast entries containing commas', () => {
  const form = movieToForm(original)
  assert.deepEqual(buildMoviePatch(form, original), {})
  assert.deepEqual(buildMoviePatch({ ...form, synopsis: ' Updated synopsis ' }, original), { synopsis: 'Updated synopsis' })
  assert.deepEqual(original.cast, ['Doe, Jane', 'Actor Two'])
})

test('runtime PATCH requires server capability, is numeric, and omits an unchanged value', () => {
  const editable = { ...original, canEditDuration: true }
  assert.deepEqual(buildMoviePatch({ ...movieToForm(editable), duration: '135' }, editable), { duration: 135 })
  assert.deepEqual(buildMoviePatch({ ...movieToForm(editable), duration: '121.0' }, editable), {})
  assert.deepEqual(buildMoviePatch({ ...movieToForm(original), duration: '135' }, { ...original, canEditDuration: false }), {})
  for (const duration of ['0', '-1', '1.5', 'bad', '']) assert.ok(validateMovieForm({ ...movieToForm(editable), duration }).duration)
})

test('PATCH whitelists changed metadata and excludes scheduling, lifecycle and internal fields', () => {
  const form = { ...movieToForm(original), title: ' Revised title ', releaseDate: '2027-01-01', ageRating: 'T16', duration: '300', status: 'PUBLISHED', releaseYear: 1990, id: 'other' }
  assert.deepEqual(buildMoviePatch(form, original), { title: 'Revised title', releaseDate: '2027-01-01', ageRating: 'T16' })
})

test('genre changes use arrays and optional media/cast can be cleared explicitly', () => {
  const form = { ...movieToForm(original), genres: ['Animation'], trailerUrl: '', cast: '' }
  assert.deepEqual(buildMoviePatch(form, original), { genres: ['Animation'], cast: [], trailerUrl: '' })
  assert.deepEqual(original.genres, ['Drama', 'Mystery'])
})

test('reverting an edit or adding only whitespace never sends a false update', () => {
  assert.deepEqual(buildMoviePatch({ ...movieToForm(original), title: ' The Film ', cast: ' Doe, Jane, Actor Two ' }, original), {})
})

test('saved server data becomes a clean baseline for the next edit', () => {
  const updated = { ...original, title: 'Server-normalized title', genres: ['Comedy'], updatedAt: '2026-10-21T09:00:00.000Z' }
  assert.deepEqual(buildMoviePatch(movieToForm(updated), updated), {})
  assert.deepEqual(buildMoviePatch({ ...movieToForm(updated), director: 'Another Director' }, updated), { director: 'Another Director' })
})

test('MOV-101 create still sends numeric duration, trimmed metadata, cast array and selected lifecycle', () => {
  const form = { ...movieToForm(original), title: ' New movie ', cast: ' Actor One, Actor Two, ' }
  for (const status of ['DRAFT', 'PUBLISHED']) {
    const input = buildCreateMovieInput(form, status)
    assert.equal(input.title, 'New movie')
    assert.equal(input.duration, 121)
    assert.deepEqual(input.cast, ['Actor One', 'Actor Two'])
    assert.deepEqual(input.genres, original.genres)
    assert.equal(input.status, status)
  }
})

test('required metadata is validated while runtime is validated only for creation', () => {
  assert.equal(Object.keys(validateMovieForm(initialMovieForm)).length, 9)
  const form = { ...movieToForm(original), duration: '0' }
  assert.ok(validateMovieForm(form).duration)
  assert.deepEqual(validateMovieForm(form, { includeDuration: false }), {})
  assert.ok(validateMovieForm({ ...form, genres: [] }, { includeDuration: false }).genres)
})

test('server field errors map nested array paths and do not rely on message text for status', () => {
  const failure = { response: { status: 400, data: { code: 'INVALID_MOVIE_INPUT', message: 'Invalid movie information', errors: [{ field: 'genres.0', message: 'Invalid genre' }, { field: 'title', message: 'Required' }] } } }
  assert.deepEqual(movieFieldErrors(failure), { genres: 'Invalid genre', title: 'Required' })
  assert.equal(movieRequestError(failure).kind, 'error')
  assert.equal(movieRequestError(failure).message, 'Invalid movie information')
})

test('load/save failures distinguish session expiry, forbidden, missing, invalid ID and network failure', () => {
  for (const [status, kind] of [[401, 'unauthenticated'], [403, 'forbidden'], [404, 'notfound']]) {
    assert.equal(movieRequestError({ response: { status, data: { message: 'Any server copy' } } }).kind, kind)
  }
  assert.equal(movieRequestError({ response: { status: 400, data: { code: 'INVALID_MOVIE_ID' } } }).kind, 'invalid')
  assert.equal(movieRequestError({}).kind, 'error')
  assert.match(movieRequestError({}).message, /connection/)
})
