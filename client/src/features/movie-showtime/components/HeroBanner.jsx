import { CalendarDays, CirclePlay, Clock3, Film } from 'lucide-react'
import { Link } from 'react-router'

const releaseDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function HeroBanner({ movie, loading }) {
  if (loading) {
    return (
      <section aria-label="Loading featured movie" className="flex min-h-[620px] animate-pulse items-end bg-surface-container-lowest pb-24 pt-28">
        <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 sm:px-6 lg:px-8">
          <div className="h-5 w-40 rounded bg-surface-container-high" />
          <div className="h-14 max-w-xl rounded bg-surface-container-high" />
          <div className="h-5 max-w-2xl rounded bg-surface-container-high" />
          <div className="h-12 w-40 rounded bg-surface-container-high" />
        </div>
      </section>
    )
  }

  if (!movie) {
    return (
      <section className="flex min-h-[520px] items-center bg-[radial-gradient(circle_at_75%_35%,rgba(229,9,20,0.2),transparent_35%)] px-4 pt-20 text-center">
        <div className="mx-auto max-w-2xl">
          <Film className="mx-auto size-12 text-primary" aria-hidden="true" />
          <h1 className="mt-5 font-heading text-4xl font-extrabold text-white sm:text-5xl">Experience cinema at F-Cinema</h1>
          <p className="mt-4 leading-7 text-on-surface-variant">Published movies will appear here when the current cinema lineup is available.</p>
          <Link to="/movies" className="mt-7 inline-flex rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson">Browse movies</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="relative flex min-h-[680px] items-end pb-28 pt-28 md:min-h-[720px]">
      <div className="absolute inset-0">
        <img src={movie.posterUrl} alt="" className="size-full scale-110 object-cover object-center blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent md:w-4/5 lg:w-3/5" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/90 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider">
            <span className="rounded bg-error-container px-2 py-1 text-on-error-container">{movie.ageRating}</span>
            {movie.genres.slice(0, 2).map((genre, index) => (
              <span key={genre} className={`rounded bg-surface-container-high px-2 py-1 ${index === 0 ? 'text-secondary' : 'text-tertiary-fixed'}`}>{genre}</span>
            ))}
            <span className="flex items-center gap-1.5 rounded bg-surface-container-low px-2 py-1 font-normal text-on-surface">
              <span className="size-1.5 animate-pulse rounded-full bg-primary-container" /> NOW SHOWING
            </span>
          </div>
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-secondary sm:text-lg">Featured at F-Cinema</p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">{movie.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:gap-4 sm:text-sm">
            <span className="flex items-center gap-1"><Clock3 className="size-4" />{movie.duration} minutes</span>
            <span>•</span>
            <span className="flex items-center gap-1"><CalendarDays className="size-4" />{releaseDateFormatter.format(new Date(movie.releaseDate))}</span>
            <span>•</span><span>{movie.language}</span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">{movie.synopsis}</p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <Link to={`/movies/${movie.id}`} className="flex items-center justify-center rounded-lg bg-primary-container px-6 py-3 font-heading text-base font-semibold text-white shadow-crimson-strong transition-transform hover:-translate-y-0.5">Explore movie</Link>
            {movie.trailerUrl && (
              <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-surface-container-highest/70 px-6 py-3 font-heading text-base font-semibold text-on-surface backdrop-blur-md transition-colors hover:bg-surface-container-highest">
                <CirclePlay className="size-5 fill-secondary text-secondary" /> Watch Trailer
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroBanner
