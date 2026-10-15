import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getMovieWithShowtimes, getPublicCinemas, getPublicShowtimes } from '../api/showtimeApi'

export function useShowtimes({ movieId, date, cinemaId, refreshToken = 0 }) {
  const requestKey = JSON.stringify({ movieId, date, cinemaId, refreshToken })
  const [state, setState] = useState({ key: '', data: null, error: '' })

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([
      getPublicShowtimes({ movieId, date, cinemaId, limit: 50 }, controller.signal),
      getPublicCinemas({ limit: 50 }, controller.signal),
      getMovieWithShowtimes(movieId, controller.signal),
    ])
      .then(([showtimesResult, cinemasResult, movieResult]) => {
        if (showtimesResult.status === 'rejected') throw showtimesResult.reason
        if (cinemasResult.status === 'rejected') throw cinemasResult.reason

        setState({
          key: requestKey,
          data: {
            showtimes: showtimesResult.value.items,
            cinemas: cinemasResult.value.items,
            movie: movieResult.status === 'fulfilled' ? movieResult.value : null,
          },
          error: '',
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setState((previous) => ({ ...previous, key: requestKey, error: getApiErrorMessage(error) }))
      })

    return () => controller.abort()
  }, [requestKey, movieId, date, cinemaId])

  return {
    ...state,
    loading: state.key !== requestKey,
  }
}
