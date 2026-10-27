import { useState } from 'react'
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, MessageSquare, RotateCw } from 'lucide-react'
import { useMovieReviews } from '../hooks/useMovieReviews'
import ReviewStars from './ReviewStars'
import ReviewComposer from './ReviewComposer'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
})

export default function MovieReviews({ movieId }) {
  const [page, setPage] = useState(1)
  const state = useMovieReviews(movieId, page)
  const onSubmitted = () => { setPage(1); state.retry() }
  return <><ReviewComposer movieId={movieId} onSubmitted={onSubmitted} /><MovieReviewsView {...state} page={page} setPage={setPage} /></>
}

export function MovieReviewsView({ data, meta, loading, error, retry, page, setPage }) {
  return <section aria-labelledby="movie-reviews-heading" className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6 lg:px-8">
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Audience voices</p>
          <h2 id="movie-reviews-heading" className="mt-2 font-heading text-2xl font-bold text-on-surface">Reviews</h2></div>
        <p className="flex items-center gap-2 text-xs text-tertiary"><ArrowDownWideNarrow className="size-4" aria-hidden="true" />Newest first</p>
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? <div role="status" aria-label="Loading reviews" className="space-y-6 py-8">
          {[0, 1].map(row => <div key={row} aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
            <div className="h-4 w-32 rounded bg-surface-container-high" /><div className="h-3 w-24 rounded bg-surface-container-high" />
            <div className="h-3 w-full rounded bg-surface-container-high" /><div className="h-3 w-2/3 rounded bg-surface-container-high" />
          </div>)}
        </div> : error ? <div className="flex min-h-56 flex-col items-center justify-center gap-4 py-8 text-center">
          <p className="font-semibold">Couldn't load reviews</p><p className="text-sm text-tertiary">Please try again.</p>
          <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <RotateCw className="size-4" aria-hidden="true" />Try again</button>
        </div> : data.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center gap-4 py-8 text-center">
          <MessageSquare className="size-6 text-tertiary" aria-hidden="true" /><p className="font-semibold">No reviews yet</p>
        </div> : <ul className="divide-y divide-white/10">
          {data.map(review => <li key={review.id} className="py-6"><article>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h3 className="min-w-0 break-words text-sm font-semibold text-on-surface [overflow-wrap:anywhere]">{review.authorDisplayName}</h3>
              <time dateTime={review.createdAt} className="text-xs text-tertiary">{dateFormatter.format(new Date(review.createdAt))}</time>
            </div>
            <div className="mt-3"><ReviewStars rating={review.rating} /></div>
            {review.content && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-tertiary [overflow-wrap:anywhere]">{review.content}</p>}
          </article></li>)}
        </ul>}
      </div>
      {!loading && !error && (page > 1 || meta?.totalPages > 1) && <nav aria-label="Review pagination" className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
        <button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-sm disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="size-4" aria-hidden="true" />Previous</button>
        <span className="text-xs text-tertiary" aria-current="page">Page {page}</span>
        <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage(value => value + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-sm disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary">Next<ChevronRight className="size-4" aria-hidden="true" /></button>
      </nav>}
    </div>
  </section>
}
