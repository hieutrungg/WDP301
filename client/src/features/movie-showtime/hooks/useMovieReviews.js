import { useCallback, useEffect, useState } from 'react'
import { getMovieReviews } from '../api/movieReviewApi'

export function useMovieReviews(movieId, page) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState(null)
  const requestKey = JSON.stringify([movieId, page, version])
  const retry = useCallback(() => setVersion(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    getMovieReviews(movieId, page, controller.signal).then(response => {
      if (active) setState({ requestKey, data: response.data, meta: response.meta, error: false })
    }).catch(() => {
      if (active) setState({ requestKey, data: [], meta: null, error: true })
    })
    return () => { active = false; controller.abort() }
  }, [movieId, page, requestKey])

  // Do not expose a prior movie/page/retry response even before the effect runs.
  const current = state?.requestKey === requestKey ? state : null
  return { data: current?.data ?? [], meta: current?.meta ?? null,
    loading: !current, error: current?.error ?? false, retry }
}
