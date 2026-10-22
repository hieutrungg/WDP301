import { useEffect, useState } from 'react'
import { getPublicCinemas } from '../../../lib/api/publicCinemaApi'
import { getRoomRequest, getRoomSummaryRequest, getSeatLayoutRequest, listRoomsRequest } from '../api/roomApi'

// Same request-keyed loader as the branch feature (React Query's convention is not finalized).
// `loading` is true until the settled result matches the current key, so the previous data stays
// on screen while the next request is in flight.
function useRemoteResource(requestKey, load) {
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    if (requestKey === null) return undefined
    const controller = new AbortController()

    load(controller.signal)
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((previous) => ({ ...previous, key: requestKey, error }))
        }
      })

    return () => controller.abort()
    // `load` is recreated every render; the request key captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: requestKey !== null && result.key !== requestKey,
  }
}

// M0 branches hold a handful of rooms each, so the picker loads them in one page.
const ROOM_PICKER_LIMIT = 200

export function useRoomList(refreshToken) {
  return useRemoteResource(`rooms:${refreshToken}`, (signal) =>
    listRoomsRequest({ limit: ROOM_PICKER_LIMIT }, signal),
  )
}

export function useSeatLayout(roomId, refreshToken) {
  return useRemoteResource(roomId ? `${roomId}:${refreshToken}` : null, (signal) =>
    getSeatLayoutRequest(roomId, signal),
  )
}

// Room management screen. The request key is the serialized filter set, so changing a filter or
// bumping `refreshToken` refetches while the previous page stays on screen.
export function useManagedRoomList({ refreshToken, ...filters }) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null))

  return useRemoteResource(`managed:${JSON.stringify({ params, refreshToken })}`, (signal) =>
    listRoomsRequest(params, signal),
  )
}

export function useRoomSummary(branchId, refreshToken) {
  return useRemoteResource(`summary:${branchId ?? ''}:${refreshToken}`, (signal) =>
    getRoomSummaryRequest(branchId ? { branchId } : {}, signal),
  )
}

export function useRoomDetail(roomId, refreshToken = 0) {
  return useRemoteResource(roomId ? `detail:${roomId}:${refreshToken}` : null, (signal) =>
    getRoomRequest(roomId, signal),
  )
}

// Only ACTIVE branches can receive rooms (A-24); the public cinema list is exactly that set and
// is readable by every role that opens this screen.
const BRANCH_OPTIONS_LIMIT = 50

export function useActiveBranches() {
  return useRemoteResource('active-branches', (signal) => getPublicCinemas({ limit: BRANCH_OPTIONS_LIMIT }, signal))
}
