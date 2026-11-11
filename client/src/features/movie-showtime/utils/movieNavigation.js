export function buildMovieCatalogPath({ cinemaId, genre } = {}) {
  const query = new URLSearchParams()
  if (cinemaId) query.set('cinemaId', cinemaId)
  if (genre) query.set('genre', genre)
  return query.size ? `/movies?${query}` : '/movies'
}

export function buildMovieShowtimesPath(movieId) {
  const query = new URLSearchParams({ movieId })
  return `/showtimes?${query.toString()}`
}
