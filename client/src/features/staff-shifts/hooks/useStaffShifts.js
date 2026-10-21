import { useEffect, useState } from 'react'
import {
  getShiftDashboardRequest,
  getShiftRequest,
  listEmployeesRequest,
  listShiftsRequest,
  listStationsRequest,
} from '../api/staffShiftApi'

// Server state without React Query (its provider/convention is not finalized yet).
// `loading` is derived from whether the settled result matches the current request key, so the
// previous data stays on screen while the next request loads.
function useRemoteResource(requestKey, load) {
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
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

  return { data: result.data, error: result.error, loading: result.key !== requestKey }
}

export function useShiftDashboard(refreshToken) {
  return useRemoteResource(`dashboard:${refreshToken}`, (signal) => getShiftDashboardRequest(signal))
}

export function useShiftList({ q, date, status, station, page, limit, refreshToken }) {
  const params = {
    q: q || undefined,
    date,
    status: status || undefined,
    station: station || undefined,
    page,
    limit,
  }

  return useRemoteResource(JSON.stringify({ ...params, refreshToken }), (signal) =>
    listShiftsRequest(params, signal),
  )
}

export function useShift(shiftId, refreshToken) {
  return useRemoteResource(`shift:${shiftId}:${refreshToken}`, (signal) => getShiftRequest(shiftId, signal))
}

export function useStations(refreshToken) {
  return useRemoteResource(`stations:${refreshToken}`, (signal) => listStationsRequest(signal))
}

export function useEmployees(q) {
  return useRemoteResource(`employees:${q}`, (signal) => listEmployeesRequest(q, signal))
}
