import { useEffect, useState } from 'react'
import { getBranchRequest, getBranchSummaryRequest, listBranchesRequest } from '../api/branchApi'

// Server state without React Query (its provider/convention is not finalized yet).
// `loading` is derived from whether the settled result matches the current request key, so
// the previous page stays on screen while the next one loads.
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

export function useBranchList({ q, status, page, limit, refreshToken }) {
  const params = { q: q || undefined, status: status || undefined, page, limit }

  return useRemoteResource(JSON.stringify({ ...params, refreshToken }), (signal) =>
    listBranchesRequest(params, signal),
  )
}

export function useBranchSummary(refreshToken) {
  return useRemoteResource(`summary:${refreshToken}`, (signal) => getBranchSummaryRequest(signal))
}

export function useBranchDetail(branchId, refreshToken) {
  return useRemoteResource(`${branchId}:${refreshToken}`, (signal) =>
    getBranchRequest(branchId, signal),
  )
}
