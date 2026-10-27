import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Star } from 'lucide-react'
import { useAuthStore } from '../../auth/store/authStore'
import { useReviewEligibility } from '../hooks/useReviewEligibility'
import { submitMovieReview } from '../api/movieReviewApi'
import { getApiErrorMessage } from '../../../lib/api/apiError'

const buttonClass = 'min-h-11 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
const reasons = {
  ALREADY_REVIEWED: 'You have already reviewed this movie.',
  AUTHOR_NAME_REQUIRED: 'Add a display name to your profile before reviewing.',
  NO_ELIGIBLE_BOOKING: 'You can review after a paid, non-refunded screening has ended.',
}

export default function ReviewComposer({ movieId, onSubmitted }) {
  const account = useAuthStore(state => state.account)
  if (!account?.roles?.some(role => role.name === 'CUSTOMER')) return null
  return <CustomerReviewComposer key={`${movieId}:${account.id}`} movieId={movieId} accountId={account.id} onSubmitted={onSubmitted} />
}

function CustomerReviewComposer({ movieId, accountId, onSubmitted }) {
  const eligibility = useReviewEligibility(movieId, accountId)
  const [rating, setRating] = useState(null)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [published, setPublished] = useState(false)
  const request = useRef(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort() }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (request.current || !rating) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      await submitMovieReview(movieId, { rating, content }, controller.signal)
      if (active.current) { setPublished(true); onSubmitted() }
    } catch (failure) {
      if (active.current) {
        const code = failure.response?.data?.code
        const field = failure.response?.data?.errors?.[0]
        setError(field ? `${field.field}: ${field.message}` : getApiErrorMessage(failure))
        if (['REVIEW_ALREADY_EXISTS', 'REVIEW_NOT_ELIGIBLE', 'REVIEW_AUTHOR_NAME_REQUIRED'].includes(code) ||
            [401, 403].includes(failure.response?.status)) eligibility.retry()
      }
    } finally {
      request.current = null
      if (active.current) setBusy(false)
    }
  }

  return <section aria-label="Write a movie review" className="mx-auto max-w-[1200px] px-4 pb-6 sm:px-6 lg:px-8">
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 sm:p-8">
      {published ? <div role="status" className="flex items-start gap-3"><CheckCircle2 className="mt-1 size-5 shrink-0 text-secondary" aria-hidden="true" />
        <div><h2 className="font-heading text-xl font-bold">Review published</h2><p className="mt-2 text-sm text-tertiary">Your review is now visible to everyone.</p></div></div>
        : <><h2 className="font-heading text-xl font-bold">Share your experience</h2>
          <div aria-live="polite">
            {eligibility.loading ? <p role="status" className="mt-4 text-sm text-tertiary">Checking review eligibility…</p>
              : eligibility.error ? <div className="mt-4 space-y-4"><p className="text-sm text-tertiary">Couldn't check whether you can review this movie.</p><button type="button" className={buttonClass} onClick={eligibility.retry}>Try again</button></div>
                : !eligibility.data?.canReview ? <p className="mt-4 text-sm text-tertiary">{reasons[eligibility.data?.reason] ?? reasons.NO_ELIGIBLE_BOOKING}</p>
                  : <ReviewForm rating={rating} setRating={setRating} content={content} setContent={setContent} busy={busy} error={error} onSubmit={submit} />}
          </div></>}
    </div>
  </section>
}

export function ReviewForm({ rating, setRating, content, setContent, busy, error, onSubmit }) {
  const id = useId()
  return <form onSubmit={onSubmit} aria-label="Movie review form" className="mt-5 space-y-5">
    <fieldset disabled={busy}>
      <legend className="text-sm font-semibold">Your rating <span aria-hidden="true">*</span></legend>
      <div className="mt-2 flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map(value => <label key={value} className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg">
          <input type="radio" name={`rating-${id}`} value={value} checked={rating === value} required disabled={busy}
            onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} className="peer sr-only" />
          <Star aria-hidden="true" className={`size-7 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary ${rating && value <= rating ? 'fill-secondary text-secondary' : 'fill-[#71737d] text-[#71737d]'}`} />
        </label>)}
      </div>
    </fieldset>
    <div><label htmlFor={`content-${id}`} className="text-sm font-semibold">Your review <span className="font-normal text-tertiary">(optional)</span></label>
      <textarea id={`content-${id}`} value={content} disabled={busy} maxLength={2000} rows={4} onChange={event => setContent(event.target.value)}
        aria-describedby={`content-help-${id}`} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-surface-container-high p-3 text-base text-on-surface focus-visible:outline-2 focus-visible:outline-primary" placeholder="Tell others about your experience" />
      <p id={`content-help-${id}`} aria-live="off" className="mt-2 text-xs text-tertiary">{content.length}/2,000 characters. Your review will be public.</p>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <button type="submit" disabled={busy || !rating} className={buttonClass}>{busy ? 'Submitting…' : 'Publish review'}</button>
  </form>
}
