import { useCallback, useEffect, useState } from 'react'
import { getReviewEligibility, getOwnMovieReview } from '../api/movieReviewApi'

export function useReviewEligibility(movieId, accountId) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState(null)
  const key = JSON.stringify([movieId, accountId, version])
  const retry = useCallback(() => setVersion(value => value + 1), [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    Promise.all([getReviewEligibility(movieId, controller.signal), getOwnMovieReview(movieId, controller.signal)]).then(([data, review]) => {
      if (active) setState({ key, data, review, error: false })
    }).catch(() => {
      if (active) setState({ key, data: null, error: true })
    })
    return () => { active = false; controller.abort() }
  }, [movieId, accountId, key])
  const current = state?.key === key ? state : null
  return { data: current?.data, review: current?.review, loading: !current, error: current?.error ?? false, retry }
}
