import {
  ArrowLeft,
  CalendarDays,
  CirclePlay,
  Clock3,
  Languages,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import ErrorState from '../../components/common/ErrorState'
import { useMovie } from '../../features/movie-showtime/hooks/useMovie'

const releaseDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

function MovieDetailSkeleton() {
  return (
    <div aria-label="Loading movie details" className="min-h-screen animate-pulse pt-20">
      <div className="h-[360px] bg-surface-container-low sm:h-[460px]" />
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <div className="aspect-[2/3] rounded-2xl bg-surface-container-high" />
        <div className="space-y-5 py-4">
          <div className="h-5 w-32 rounded bg-surface-container-high" />
          <div className="h-12 w-3/4 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container-high" />
          <div className="h-4 w-5/6 rounded bg-surface-container-high" />
        </div>
      </div>
    </div>
  )
}

function MovieDetailPage() {
  const { movieId } = useParams()
  const { movie, loading, error, retry } = useMovie(movieId)

  if (loading) return <MovieDetailSkeleton />

  if (error) {
    return (
      <div className="mx-auto min-h-[80vh] max-w-3xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <ErrorState message={error} onRetry={retry} />
        <Link to="/movies" className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:text-white">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to movies
        </Link>
      </div>
    )
  }

  if (!movie) return null

  return (
    <article className="min-h-screen pt-20">
      <section className="relative isolate overflow-hidden border-b border-white/5 bg-surface-container-lowest">
        <img src={movie.posterUrl} alt="" className="absolute inset-0 -z-20 size-full scale-110 object-cover opacity-25 blur-2xl" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/90 to-background/50" />
        <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
          <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <Link to="/" className="hover:text-on-surface">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/movies" className="hover:text-on-surface">Movies</Link>
            <span aria-hidden="true">/</span>
            <span className="text-on-surface">{movie.title}</span>
          </nav>

          <div className="grid items-end gap-8 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
            <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-surface-container shadow-2xl md:mx-0">
              <img src={movie.posterUrl} alt={`${movie.title} poster`} className="aspect-[2/3] size-full object-cover" />
              <span className="absolute left-4 top-4 rounded bg-error-container px-3 py-1.5 text-xs font-extrabold tracking-wide text-on-error-container shadow-lg">
                {movie.ageRating}
              </span>
            </div>

            <div className="pb-2">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-secondary">Now showing at F-Cinema</p>
              <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">{movie.title}</h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/10 bg-surface-container-high/80 px-3 py-1 text-xs text-on-surface backdrop-blur">
                    {genre}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-on-surface-variant">
                <span className="flex items-center gap-2"><Clock3 className="size-4 text-primary" aria-hidden="true" />{movie.duration} minutes</span>
                <span className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" aria-hidden="true" />{releaseDateFormatter.format(new Date(movie.releaseDate))}</span>
                <span className="flex items-center gap-2"><Languages className="size-4 text-primary" aria-hidden="true" />{movie.language}</span>
              </div>
              
              <div className="mt-8 flex flex-wrap gap-3">
                {movie.trailerUrl && (
                  <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson transition-transform hover:-translate-y-0.5">
                    <CirclePlay className="size-5" aria-hidden="true" /> Watch trailer
                  </a>
                )}
                <Link to="/movies" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-container-high/80 px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container-highest">
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back to lineup
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-14">
        <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Story</p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-on-surface">Synopsis</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-on-surface-variant sm:text-base">{movie.synopsis}</p>
        </div>

        <aside className="rounded-2xl border border-white/5 bg-surface-container-low p-6">
          <h2 className="font-heading text-xl font-bold text-on-surface">Cast &amp; crew</h2>
          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Director</dt>
              <dd className="mt-1 flex items-center gap-2 text-on-surface"><UserRound className="size-4 text-secondary" aria-hidden="true" />{movie.director}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Principal cast</dt>
              <dd className="mt-2 text-on-surface">
                {movie.cast.length > 0 ? movie.cast.join(', ') : 'Cast information is not available.'}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </article>
  )
}

export default MovieDetailPage
