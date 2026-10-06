import { Clock3, Star } from 'lucide-react'

const ageBadgeColors = {
  P: 'bg-secondary-container text-on-secondary-container',
  K: 'bg-tertiary-container text-on-tertiary-container',
  T13: 'bg-secondary-container text-on-secondary-container',
  T16: 'bg-error-container text-on-error-container',
  T18: 'bg-error-container text-on-error-container',
}

function MovieCard({ movie }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-white/5 bg-surface-container shadow-lg transition-transform duration-300 hover:-translate-y-2">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-container-high">
        <img src={movie.poster} alt={`${movie.title} movie poster`} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-80" />
        <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${ageBadgeColors[movie.ageRating]}`}>{movie.ageRating}</span>
          {movie.highlight && <span className="rounded bg-primary-container px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">{movie.highlight}</span>}
          {movie.formatBadge && <span className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-bold text-secondary">{movie.formatBadge}</span>}
        </div>
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-surface-container-lowest/80 px-1.5 py-0.5 backdrop-blur-md">
          <Star className="size-3.5 fill-secondary text-secondary" /><span className="text-xs font-semibold text-on-surface">{movie.rating}</span>
        </div>
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-surface-container-lowest/90 p-4 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <a href="#quick-booking" className="w-full rounded-lg bg-primary-container py-2.5 text-center text-sm font-semibold text-white shadow-crimson">Book Tickets</a>
          <button type="button" className="w-full rounded-lg bg-surface-container-highest py-2 text-sm text-on-surface transition-colors hover:bg-surface-variant">View Details</button>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-sm font-bold text-on-surface transition-colors group-hover:text-primary sm:text-base">{movie.title}</h3>
          <p className="truncate text-xs text-on-surface-variant">{movie.genres}</p>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1"><Clock3 className="size-3.5" />{movie.duration}</span>
          <span className="truncate rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold text-on-surface">{movie.format}</span>
        </div>
      </div>
    </article>
  )
}

export default MovieCard
