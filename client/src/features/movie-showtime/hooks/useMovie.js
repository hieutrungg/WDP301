import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getMovie } from '../api/movieApi'

export function useMovie(movieId) {
  const [state, setState] = useState({ movie: null, movieId: null, requestVersion: -1, error: '' })
  const [requestVersion, setRequestVersion] = useState(0)

  const retry = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    getMovie(movieId, controller.signal)
      .then((response) => {
        setState({
          movie: response.data ?? null,
          movieId,
          requestVersion,
          error: '',
        })
      })
      .catch((error) => {
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return
        setState({ movie: null, movieId, requestVersion, error: getApiErrorMessage(error) })
      })

    return () => controller.abort()
  }, [movieId, requestVersion])

  const loading = state.movieId !== movieId || state.requestVersion !== requestVersion

  return { ...state, loading, retry }
}
