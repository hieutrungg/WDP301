import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Archive, Film, LoaderCircle, Pencil, Plus, Search } from 'lucide-react'
import ArchiveMovieModal from '../components/ArchiveMovieModal'
import { useAuth } from '../../auth/hooks/useAuth'
import { listManagerMovies } from '../api/managerMovieApi'

export default function ManagerMoviesPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const requestedPage = Number(params.get('page') || 1)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [request, setRequest] = useState(null)
  const [retry, setRetry] = useState(0)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archived, setArchived] = useState(null)
  const requestKey = JSON.stringify([query, page, retry])
  const result = request?.key === requestKey ? request.result : null
  const error = request?.key === requestKey ? request.error : null
  const loading = request?.key !== requestKey
  const { account } = useAuth()
  const canCreate = account?.permissions?.some(({ name }) => name === 'movie.create')
  const canArchive = account?.permissions?.some(({ name }) => name === 'movie.archive')

  useEffect(() => {
    const controller = new AbortController()
    listManagerMovies({ q: query || undefined, page, limit: 12 }, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setRequest({ key: requestKey, result: data }) })
      .catch((failure) => {
        if (!controller.signal.aborted) setRequest({ key: requestKey, error: { status: failure.response?.status, message: failure.response?.data?.message || 'Unable to load movies. Please try again.' } })
      })
    return () => controller.abort()
  }, [query, page, requestKey])

  function navigatePage(nextPage) {
    setParams({ ...(query ? { q: query } : {}), page: String(nextPage) })
  }

  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    {archiveTarget && <ArchiveMovieModal key={archiveTarget.id} movie={archiveTarget} onClose={() => setArchiveTarget(null)} onArchived={(updated) => {
      setArchived(updated)
      setArchiveTarget(null)
      setRetry((value) => value + 1)
    }} />}
    {archived && <p role="status" className="rounded-lg border border-green-400/30 bg-green-400/10 p-4 text-sm text-green-200">{archived.title} is archived. Its history has been preserved.</p>}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Movie catalog & distribution</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Movie Management</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Find an existing movie and edit its information.</p></div>
      {canCreate && <Link to="/manager/movies/new" className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson"><Plus className="size-4" />Add New Movie</Link>}
    </div>
    <form className="flex gap-3" onSubmit={(event) => {
      event.preventDefault()
      const search = new FormData(event.currentTarget).get('q').trim()
      setParams(search ? { q: search } : {})
    }}>
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search movies by title</span><Search className="absolute left-3 top-3.5 size-4 text-on-surface-variant" />
        <input key={query} name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search movies by title…" className="w-full rounded-lg border border-white/10 bg-surface-container-low px-10 py-3 text-sm outline-none focus:border-primary" /></label>
      <button className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold" type="submit">Search</button>
    </form>
    {loading ? <div role="status" className="flex items-center gap-3 py-12 text-on-surface-variant"><LoaderCircle className="size-5 animate-spin" />Loading movies…</div>
      : error ? <div role="alert" className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">
        <p>{error.status === 403 ? 'You do not have permission to manage movies.' : error.status === 401 ? 'Your session has expired. Please sign in again.' : error.message}</p>
        {error.status === 401 ? <Link to="/login" className="underline">Sign in</Link> : error.status !== 403 && <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Try again</button>}
      </div>
      : <>
        {result?.data.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.data.map((movie) => <article key={movie.id} className="flex min-w-0 gap-4 rounded-xl border border-white/10 bg-surface-container-low p-5">
            <Film aria-hidden="true" className="mt-1 size-7 shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{movie.status}</p>
              <h2 className="mt-1 break-words text-lg font-bold">{movie.title}</h2>
              <p className="mt-1 text-xs text-on-surface-variant">{movie.releaseDate.slice(0, 4)} · {movie.duration} min · {movie.ageRating}</p>
              <Link to={`/manager/movies/${movie.id}/edit`} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:border-primary"><Pencil className="size-3.5" />Edit Details<span className="sr-only"> for {movie.title}</span></Link>
              {canArchive && movie.status !== 'ARCHIVED' && <button type="button" onClick={() => { setArchived(null); setArchiveTarget(movie) }} className="ml-2 mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary"><Archive className="size-3.5" />Archive<span className="sr-only"> {movie.title}</span></button>}
            </div>
          </article>)}
        </div> : <p role="status" className="rounded-xl border border-white/10 bg-surface-container-low p-8 text-center text-on-surface-variant">{query ? 'No movies match this search.' : 'No movies found.'}</p>}
        {result?.meta && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
          <p>{result.meta.total} movies · Page {page} of {Math.max(1, result.meta.totalPages)}</p>
          <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => navigatePage(page - 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= result.meta.totalPages} onClick={() => navigatePage(page + 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">Next</button></div>
        </div>}
      </>}
  </section>
}
