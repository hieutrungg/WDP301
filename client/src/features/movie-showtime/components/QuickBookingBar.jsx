import { useState } from 'react'
import { CalendarDays, ChevronDown, Clapperboard, MapPin, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router'

function QuickBookingBar({ movies, loading }) {
  const navigate = useNavigate()
  const [movieId, setMovieId] = useState('')
  const selectedMovie = movies.find(({ id }) => id === movieId)

  const handleSubmit = (event) => {
    event.preventDefault()
    const search = new URLSearchParams()
    if (movieId) search.set('movieId', movieId)
    const query = search.toString()
    navigate(`/showtimes${query ? `?${query}` : ''}`)
  }

  return (
    <section aria-label="Quick booking" className="relative z-10 mx-auto -mt-7 w-full max-w-[1200px] px-4 sm:-mt-10 sm:px-6 lg:px-8">
      <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-white/10 bg-surface-container/90 p-3 shadow-2xl backdrop-blur-xl sm:grid-cols-[1fr_auto] sm:items-end sm:p-4">
        <label className="block min-w-0">
          <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant"><Clapperboard className="size-4 text-primary" />Choose a movie</span>
          <span className="relative block">
            <select value={movieId} onChange={(event) => setMovieId(event.target.value)} disabled={loading || movies.length === 0} className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-surface-container-low px-4 pr-10 text-sm text-on-surface outline-none transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/30 disabled:opacity-60">
              <option value="">All movies</option>
              {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          </span>
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-secondary" />Choose a cinema branch on showtimes</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-secondary" />Choose a date on showtimes</span>
          </span>
        </label>
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-container px-6 text-sm font-bold text-on-primary-container shadow-crimson transition hover:-translate-y-0.5 hover:shadow-crimson-strong">
          <Ticket className="size-4" aria-hidden="true" />{selectedMovie ? 'Find Showtimes' : 'Quick Booking'}
        </button>
      </form>
    </section>
  )
}

export default QuickBookingBar
