import { useCallback, useEffect, useState } from 'react'
import { getReviewEligibility } from '../api/movieReviewApi'

export function useReviewEligibility(movieId, accountId) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState(null)
  const key = JSON.stringify([movieId, accountId, version])
  const retry = useCallback(() => setVersion(value => value + 1), [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getReviewEligibility(movieId, controller.signal).then(data => {
      if (active) setState({ key, data, error: false })
    }).catch(() => {
      if (active) setState({ key, data: null, error: true })
    })
    return () => { active = false; controller.abort() }
  }, [movieId, accountId, key])
  const current = state?.key === key ? state : null
  return { data: current?.data, loading: !current, error: current?.error ?? false, retry }
}
