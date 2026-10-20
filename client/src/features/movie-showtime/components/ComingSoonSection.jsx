import { CalendarDays, Film } from 'lucide-react'
import { Link } from 'react-router'

const releaseDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function ComingSoonSection({ movies }) {
  if (movies.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="coming-soon-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-secondary">Mark Your Calendar</p>
          <h2 id="coming-soon-heading" className="mt-1 font-heading text-2xl font-bold text-on-surface sm:text-3xl">Coming Soon to F-Cinema</h2>
        </div>
        <Link to="/movies" className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-on-surface transition hover:border-primary-container hover:text-primary sm:inline-flex">Explore Movies</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {movies.map((movie) => (
          <Link key={movie.id} to={`/movies/${movie.id}`} aria-label={`View details for ${movie.title}`} className="group flex min-w-0 overflow-hidden rounded-xl border border-white/5 bg-surface-container shadow-lg transition hover:-translate-y-1 hover:border-primary-container/50">
            <div className="relative aspect-[16/10] w-[42%] shrink-0 overflow-hidden bg-surface-container-high sm:w-[38%] lg:w-[42%]">
              {movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="grid size-full place-items-center"><Film className="size-8 text-primary" aria-hidden="true" /></div>}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent to-surface-container/80" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3 sm:p-4">
              <span className="w-fit rounded bg-secondary-container/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-secondary">Coming Soon</span>
              <h3 className="line-clamp-2 font-heading text-sm font-bold leading-snug text-on-surface transition-colors group-hover:text-primary sm:text-base">{movie.title}</h3>
              <p className="line-clamp-1 text-xs text-on-surface-variant">{movie.genres?.join(' · ')}</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant"><CalendarDays className="size-3.5 text-secondary" aria-hidden="true" />{releaseDateFormatter.format(new Date(`${movie.releaseDate.slice(0, 10)}T12:00:00Z`))}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default ComingSoonSection
