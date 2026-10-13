import { ChevronLeft, ChevronRight, Clapperboard, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import MovieCatalogCard from '../../features/movie-showtime/components/MovieCatalogCard'
import MovieCatalogSkeleton from '../../features/movie-showtime/components/MovieCatalogSkeleton'
import { useMovies } from '../../features/movie-showtime/hooks/useMovies'

const genres = ['Adventure', 'Animation', 'Drama', 'Family', 'Mystery', 'Romance', 'Science Fiction']

function MoviesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const genre = searchParams.get('genre') || ''
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const requestParams = new URLSearchParams()

  if (q) requestParams.set('q', q)
  if (genre) requestParams.set('genre', genre)
  requestParams.set('page', String(page))
  requestParams.set('limit', '12')

  const { movies, meta, loading, error, retry } = useMovies(requestParams.toString())
  const hasFilters = Boolean(q || genre)

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next)
  }

  const handleSearch = (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    updateParams({ q: formData.get('q').toString().trim(), page: '' })
  }

  const clearFilters = () => setSearchParams({})

  return (
    <div className="min-h-screen pt-20">
      <section className="relative overflow-hidden border-b border-white/5 bg-surface-container-lowest">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(229,9,20,0.24),transparent_32%),linear-gradient(115deg,rgba(245,197,24,0.06),transparent_35%)]" />
        <div className="relative mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-on-surface-variant">
            <Link to="/" className="hover:text-on-surface">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Movies</span>
            <span aria-hidden="true">/</span>
            <span className="text-on-surface">Now Showing</span>
          </nav>
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-secondary">
              <Sparkles className="size-4" aria-hidden="true" />
              <span className="text-xs font-extrabold uppercase tracking-[0.24em]">Premier cinematic lineup</span>
            </div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">Now Showing</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">Explore published movies currently available at F-Cinema. Search by title or narrow the lineup by genre.</p>
          </div>
          <div className="mt-9 flex gap-2 overflow-x-auto pb-1 text-sm scrollbar-none" aria-label="Movie catalogue sections">
            <span className="shrink-0 rounded-full bg-primary-container px-4 py-2 font-bold text-white shadow-crimson">Now Showing</span>
            <span aria-disabled="true" className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-on-surface-variant/60">Coming Soon</span>
            <span aria-disabled="true" className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-on-surface-variant/60">Special Screenings</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="rounded-2xl border border-white/5 bg-surface-container-low p-4 shadow-xl sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
            Find your movie
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <form key={q} onSubmit={handleSearch} className="flex min-w-0 gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search by movie title</span>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
                <input name="q" type="search" defaultValue={q} placeholder="Search by movie title..." className="h-11 w-full rounded-lg border border-white/10 bg-surface-container py-2 pl-10 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container" />
              </label>
              <button type="submit" className="h-11 rounded-lg bg-primary-container px-4 text-sm font-bold text-white transition-opacity hover:opacity-90">Search</button>
            </form>
            <label>
              <span className="sr-only">Filter by genre</span>
              <select value={genre} onChange={(event) => updateParams({ genre: event.target.value, page: '' })} className="h-11 w-full rounded-lg border border-white/10 bg-surface-container px-3 text-sm text-on-surface outline-none focus:border-primary-container">
                <option value="">All genres</option>
                {genres.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {hasFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              <span>{meta.total} result{meta.total === 1 ? '' : 's'}</span>
              {q && <span className="rounded-full bg-surface-container-high px-3 py-1">Title: “{q}”</span>}
              {genre && <span className="rounded-full bg-surface-container-high px-3 py-1">Genre: {genre}</span>}
              <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:text-white">Clear filters</button>
            </div>
          )}
        </div>

        <div className="mt-8">
          {loading && <MovieCatalogSkeleton />}
          {!loading && error && <ErrorState message={error} onRetry={retry} />}
          {!loading && !error && movies.length === 0 && (
            <EmptyState
              title={hasFilters ? 'No movies match your search' : 'No movies are showing right now'}
              description={hasFilters ? 'Try another title or genre, or clear your filters to see the full lineup.' : 'Published movies will appear here when the cinema lineup is available.'}
              action={hasFilters ? <button type="button" onClick={clearFilters} className="rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white">Clear filters</button> : undefined}
            />
          )}
          {!loading && !error && movies.length > 0 && (
            <>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-primary"><Clapperboard className="size-5" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wider">On the big screen</span></div>
                  <h2 className="mt-1 font-heading text-2xl font-bold text-on-surface">Movie lineup</h2>
                </div>
                <p className="text-xs text-on-surface-variant">{meta.total} published movie{meta.total === 1 ? '' : 's'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
                {movies.map((movie) => <MovieCatalogCard key={movie.id} movie={movie} />)}
              </div>
              {meta.totalPages > 1 && (
                <nav aria-label="Movie results pages" className="mt-10 flex items-center justify-center gap-3">
                  <button type="button" disabled={meta.page <= 1} onClick={() => updateParams({ page: String(meta.page - 1) })} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-40">
                    <ChevronLeft className="size-4" aria-hidden="true" /> Previous
                  </button>
                  <span className="text-sm text-on-surface-variant">Page {meta.page} of {meta.totalPages}</span>
                  <button type="button" disabled={meta.page >= meta.totalPages} onClick={() => updateParams({ page: String(meta.page + 1) })} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-40">
                    Next <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default MoviesPage
