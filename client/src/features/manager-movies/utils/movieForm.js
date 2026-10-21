export const initialMovieForm = {
  title: '', releaseDate: '', duration: '', genres: [], ageRating: '', language: '',
  director: '', cast: '', trailerUrl: '', synopsis: '', posterUrl: '',
}

const editableFields = [
  'title', 'releaseDate', 'genres', 'ageRating', 'language', 'director',
  'cast', 'trailerUrl', 'synopsis', 'posterUrl',
]

const splitCast = (value) => value.split(',').map((item) => item.trim()).filter(Boolean)

export function movieToForm(movie) {
  return {
    ...Object.fromEntries(Object.keys(initialMovieForm).map((field) => [field, movie[field] ?? ''])),
    duration: String(movie.duration ?? ''),
    releaseDate: movie.releaseDate?.slice(0, 10) ?? '',
    genres: [...(movie.genres ?? [])],
    cast: (movie.cast ?? []).join(', '),
  }
}

export function validateMovieForm(form, { includeDuration = true } = {}) {
  const errors = {}
  for (const name of ['title', 'releaseDate', 'language', 'director', 'ageRating', 'synopsis', 'posterUrl']) {
    if (!form[name].trim()) errors[name] = 'This field is required'
  }
  if (!form.genres.length) errors.genres = 'Add at least one genre'
  if (includeDuration && (!Number.isInteger(Number(form.duration)) || Number(form.duration) <= 0)) {
    errors.duration = 'Enter a whole number greater than zero'
  }
  return errors
}

export function buildCreateMovieInput(form, status) {
  return {
    ...Object.fromEntries(Object.entries(form).filter(([key]) => key !== 'genres').map(([key, value]) => [key, value.trim()])),
    duration: Number(form.duration), genres: form.genres, cast: splitCast(form.cast), status,
  }
}

export function buildMoviePatch(form, originalMovie) {
  const baseline = movieToForm(originalMovie)
  const fields = originalMovie.canEditDuration === true ? [...editableFields, 'duration'] : editableFields
  return Object.fromEntries(fields.flatMap((field) => {
    if (field === 'duration') return Number(form.duration) === Number(baseline.duration) ? [] : [[field, Number(form.duration)]]
    if (field === 'genres') {
      return JSON.stringify(form.genres) === JSON.stringify(baseline.genres) ? [] : [[field, [...form.genres]]]
    }
    // Compare the displayed text first: unchanged cast entries may themselves contain commas.
    // Never reserialize an untouched array or send internal/lifecycle/scheduling fields.
    if (form[field].trim() === baseline[field].trim()) return []
    return [[field, field === 'cast' ? splitCast(form[field]) : form[field].trim()]]
  }))
}

export function movieFieldErrors(failure) {
  return Object.fromEntries((failure.response?.data?.errors ?? [])
    .filter(({ field, message }) => typeof field === 'string' && typeof message === 'string')
    .map(({ field, message }) => [field.split('.')[0], message]))
}

export function movieRequestError(failure) {
  const status = failure.response?.status
  const body = failure.response?.data
  if (status === 401) return { kind: 'unauthenticated', title: 'Your session has ended', message: 'Sign in again to manage this movie.' }
  if (status === 403) return { kind: 'forbidden', title: 'You do not have permission to edit this movie', message: 'Your account needs permission to update movies.' }
  if (status === 404 || body?.code === 'MOVIE_NOT_FOUND') return { kind: 'notfound', title: 'Movie not found', message: 'This movie could not be found. Return to Movie Management to select another movie.' }
  if (body?.code === 'INVALID_MOVIE_ID') return { kind: 'invalid', title: 'Invalid movie link', message: 'Return to Movie Management to select a movie.' }
  return { kind: 'error', title: 'Unable to complete your request', message: body?.message || 'Unable to reach the server. Please check your connection and try again.' }
}
