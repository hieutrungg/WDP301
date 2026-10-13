import { ArrowRight, Flame } from 'lucide-react'
import { Link } from 'react-router'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import MovieCatalogCard from './MovieCatalogCard'
import MovieCatalogSkeleton from './MovieCatalogSkeleton'

function NowShowingSection({ movies, loading, error, onRetry }) {
  const genres = [...new Set(movies.flatMap((movie) => movie.genres))].slice(0, 4)

  return (
    <section id="movies" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-1 text-primary-container"><Flame className="size-5" /><span className="text-[11px] font-bold uppercase tracking-wider">Premium Experience</span></div>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Now Showing</h2>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-surface-container-low p-1">
            <Link to="/movies" className="shrink-0 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-white">All</Link>
            {genres.map((genre) => (
              <Link key={genre} to={`/movies?genre=${encodeURIComponent(genre)}`} className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">{genre}</Link>
            ))}
          </div>
          <Link to="/movies" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary sm:flex">View All <ArrowRight className="size-4" /></Link>
        </div>
      </div>
      {loading && <MovieCatalogSkeleton count={5} className="grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5" />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && movies.length === 0 && (
        <EmptyState title="No movies are showing right now" description="Published movies will appear here when the cinema lineup is available." />
      )}
      {!loading && !error && movies.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {movies.map((movie) => <MovieCatalogCard key={movie.id} movie={movie} />)}
        </div>
      )}
    </section>
  )
}

export default NowShowingSection
