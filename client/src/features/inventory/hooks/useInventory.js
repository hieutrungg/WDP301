import { useEffect, useState } from 'react'
import {
  getStockSummaryRequest,
  listCategoriesRequest,
  listStockInHistoryRequest,
  listStockLevelsRequest,
  listSuppliersRequest,
} from '../api/inventoryApi'

const PICKER_PAGE_SIZE = 50
const PICKER_MAX_PAGES = 20

// Server state without React Query (its provider/convention is not finalized yet).
// `loading` is derived from whether the settled result matches the current request key, so the
// previous page stays on screen while the next one loads.
function useRemoteResource(requestKey, load, enabled = true) {
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    if (!enabled) {
      setResult({ key: requestKey, data: null, error: null })
      return undefined
    }

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
  }, [requestKey, enabled])

  return { data: result.data, error: result.error, loading: enabled && result.key !== requestKey }
}

export function useStockLevels({ q, categoryId, status, page, limit, refreshToken }) {
  const params = { q: q || undefined, categoryId: categoryId || undefined, status: status || undefined, page, limit }

  return useRemoteResource(JSON.stringify({ ...params, refreshToken }), (signal) =>
    listStockLevelsRequest(params, signal),
  )
}

export function useStockSummary(refreshToken, enabled = true) {
  return useRemoteResource(`summary:${refreshToken}`, (signal) => getStockSummaryRequest(signal), enabled)
}

export function useCategories() {
  return useRemoteResource('categories', (signal) => listCategoriesRequest(signal))
}

export function useSuppliers() {
  return useRemoteResource('suppliers', (signal) => listSuppliersRequest(signal))
}

export function useStockInHistory({ page, limit, refreshToken }) {
  return useRemoteResource(`history:${page}:${limit}:${refreshToken}`, (signal) =>
    listStockInHistoryRequest({ page, limit }, signal),
  )
}

// The stock-in form needs every active item in its picker, and the list endpoint is paginated.
export function useAllStockItems(refreshToken = 0) {
  return useRemoteResource(`all-items:${refreshToken}`, async (signal) => {
    const items = []

    for (let page = 1; page <= PICKER_MAX_PAGES; page += 1) {
      const result = await listStockLevelsRequest({ page, limit: PICKER_PAGE_SIZE }, signal)
      items.push(...result.items)
      if (page >= result.meta.totalPages) break
    }

    return items.sort((a, b) => a.name.localeCompare(b.name))
  })
}
