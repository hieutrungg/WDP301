import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getMovies } from '../api/movieApi'

const initialMeta = { page: 1, limit: 12, total: 0, totalPages: 0 }

export function useMovies(queryString) {
  const [state, setState] = useState({ movies: [], meta: initialMeta, queryString: null, requestVersion: -1, error: '' })
  const [requestVersion, setRequestVersion] = useState(0)

  const retry = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    getMovies(queryString, controller.signal)
      .then((response) => {
        setState({
          movies: Array.isArray(response.data) ? response.data : [],
          meta: { ...initialMeta, ...response.meta },
          queryString,
          requestVersion,
          error: '',
        })
      })
      .catch((error) => {
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return
        setState((current) => ({ ...current, queryString, requestVersion, error: getApiErrorMessage(error) }))
      })

    return () => controller.abort()
  }, [queryString, requestVersion])

  const loading = state.queryString !== queryString || state.requestVersion !== requestVersion

  return { ...state, loading, retry }
}
