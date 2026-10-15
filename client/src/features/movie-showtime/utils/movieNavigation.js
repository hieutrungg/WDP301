export function buildMovieShowtimesPath(movieId) {
  const query = new URLSearchParams({ movieId })
  return `/showtimes?${query.toString()}`
}
