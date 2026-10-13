import { CalendarDays, Clock3 } from 'lucide-react'
import { Link } from 'react-router'

const ageBadgeColors = {
  P: 'bg-secondary-container text-on-secondary-container',
  K: 'bg-tertiary-container text-on-tertiary-container',
  T13: 'bg-secondary-container text-on-secondary-container',
  T16: 'bg-error-container text-on-error-container',
  T18: 'bg-error-container text-on-error-container',
}

const releaseDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function MovieCatalogCard({ movie }) {
  return (
    <Link to={`/movies/${movie.id}`} aria-label={`View details for ${movie.title}`} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-surface-container shadow-lg outline-none transition duration-300 hover:-translate-y-1 hover:border-primary-container/50 focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-container-high">
        <img src={movie.posterUrl} alt={`${movie.title} poster`} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-80" />
        <span className={`absolute left-3 top-3 rounded px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${ageBadgeColors[movie.ageRating] || 'bg-surface-container-highest text-on-surface'}`}>
          {movie.ageRating}
        </span>
        <span className="absolute inset-x-3 bottom-3 translate-y-2 rounded-lg bg-primary-container px-3 py-2 text-center text-xs font-bold text-white opacity-0 shadow-crimson transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          View movie details
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 className="line-clamp-2 font-heading text-base font-bold leading-snug text-on-surface transition-colors group-hover:text-primary">{movie.title}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">{movie.genres.join(' · ')}</p>
        </div>
        <div className="mt-auto grid gap-1.5 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{movie.duration} min</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />{releaseDateFormatter.format(new Date(movie.releaseDate))}</span>
        </div>
      </div>
    </Link>
  )
}

export default MovieCatalogCard
