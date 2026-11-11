export const MOVIE_PAGE_SIZE = 12

const sortOptions = new Set(['releaseDate-desc', 'releaseDate-asc', 'title-asc', 'title-desc'])

const parsePage = (value) => {
  if (!/^\d+$/.test(value ?? '')) return 1

  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

export function readMovieSearchParams(searchParams) {
  const q = (searchParams.get('q') ?? '').trim()
  const genre = (searchParams.get('genre') ?? '').trim()
  const requestedSort = searchParams.get('sort') ?? 'releaseDate-desc'
  const sortOption = sortOptions.has(requestedSort) ? requestedSort : 'releaseDate-desc'
  const [sort, order] = sortOption.split('-')

  return {
    q,
    genre,
    page: parsePage(searchParams.get('page')),
    sort,
    order,
    sortOption,
  }
}

export function getVietnamDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function buildMovieQuery({ q, genre, cinemaId, releaseTo, page, sort, order }) {
  const query = new URLSearchParams()

  if (q) query.set('q', q)
  if (genre) query.set('genre', genre)
  if (cinemaId) query.set('cinemaId', cinemaId)
  if (releaseTo) query.set('releaseTo', releaseTo)
  query.set('page', String(page))
  query.set('limit', String(MOVIE_PAGE_SIZE))
  query.set('sort', sort)
  query.set('order', order)

  return query.toString()
}

export function getVisibleMoviePages(currentPage, totalPages, maximum = 5) {
  if (totalPages <= 0) return []

  const visibleCount = Math.min(maximum, totalPages)
  const half = Math.floor(visibleCount / 2)
  const start = Math.min(
    Math.max(currentPage - half, 1),
    totalPages - visibleCount + 1,
  )

  return Array.from({ length: visibleCount }, (_, index) => start + index)
}
