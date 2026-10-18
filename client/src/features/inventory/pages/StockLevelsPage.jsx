import { Boxes, PackagePlus, RefreshCw, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import Pagination from '../components/Pagination'
import StockLevelTable from '../components/StockLevelTable'
import { StockAlerts, StockSummaryCards } from '../components/StockSummary'
import StockToolbar from '../components/StockToolbar'
import { useCategories, useStockLevels, useStockSummary } from '../hooks/useInventory'

const PAGE_SIZE = 10
const STATUS_FILTERS = new Set(['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK'])

const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status') ?? ''

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    categoryId: /^[a-f\d]{24}$/i.test(searchParams.get('categoryId') ?? '') ? searchParams.get('categoryId') : '',
    status: STATUS_FILTERS.has(status) ? status : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading stock levels">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="grid gap-3 border-t border-white/5 px-5 py-5 first:border-t-0 lg:grid-cols-6">
          {Array.from({ length: 6 }, (__, cell) => (
            <span key={cell} className="h-4 animate-pulse rounded bg-surface-container-high" />
          ))}
        </li>
      ))}
    </ul>
  )
}

function ListMessage({ icon: Icon, title, body, action }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-heading text-lg font-bold text-on-surface">{title}</p>
      <p className="mt-1 max-w-md text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// UC39 Track Concession Stock Level. Staff and Manager use the same screen; only Staff get the
// UC40 entry point. `stockInPath` is the staff route to the stock-in form.
function StockLevelsPage({ stockInPath }) {
  const { account } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const [refreshToken, setRefreshToken] = useState(0)

  const canStockIn =
    Boolean(stockInPath) &&
    account?.permissions?.some(({ name }) => name === 'inventory.stock_in') &&
    account?.roles?.some(({ name }) => name === 'STAFF')

  const list = useStockLevels({ ...filters, limit: PAGE_SIZE, refreshToken })
  const summary = useStockSummary(refreshToken)
  const categories = useCategories()
  const items = list.data?.items ?? []
  const meta = list.data?.meta

  const refresh = () => setRefreshToken((token) => token + 1)

  const updateFilters = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const params = {}
    if (next.q) params.q = next.q
    if (next.categoryId) params.categoryId = next.categoryId
    if (next.status) params.status = next.status
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params, { replace: true })
  }

  const hasFilters = Boolean(filters.q || filters.categoryId || filters.status)

  let content
  if (list.loading && !list.data) {
    content = <ListSkeleton />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Stock levels could not be loaded"
        body={getApiErrorMessage(list.error)}
        action={
          <button type="button" onClick={refresh} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      />
    )
  } else if (items.length === 0 && filters.page > 1 && meta?.total > 0) {
    content = (
      <ListMessage
        icon={SearchX}
        title="This page is empty"
        body="The list changed since this page was opened."
        action={
          <button type="button" onClick={() => updateFilters({ page: 1 })} className={secondaryButton}>
            Go to first page
          </button>
        }
      />
    )
  } else if (items.length === 0) {
    // UC39 alternative sequence at step 3: empty result message.
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No items match these filters"
        body="Try a different name, or clear the category and status filters."
        action={
          <button type="button" onClick={() => updateFilters({ q: '', categoryId: '', status: '' })} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage
        icon={Boxes}
        title="No concession items yet"
        body="Items must be created by a manager or admin before stock can be tracked."
      />
    )
  } else {
    content = <StockLevelTable items={items} restockPath={canStockIn ? stockInPath : null} />
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary-container" />
            Concession inventory
          </p>
          <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
            Concession Stock Levels
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Current stock for your branch. Items at or below their minimum threshold are flagged as
            low stock, and items with zero quantity are out of stock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Refresh
          </button>
          {canStockIn && (
            <Link
              to={stockInPath}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90"
            >
              <PackagePlus className="size-4" strokeWidth={2.5} />
              Stock goods
            </Link>
          )}
        </div>
      </section>

      <StockSummaryCards summary={summary.data} loading={summary.loading} error={summary.error} />
      <StockAlerts summary={summary.data} />

      <StockToolbar
        query={filters.q}
        categoryId={filters.categoryId}
        status={filters.status}
        categories={categories.data}
        summary={summary.data}
        onQueryChange={(q) => updateFilters({ q })}
        onCategoryChange={(categoryId) => updateFilters({ categoryId })}
        onStatusChange={(status) => updateFilters({ status })}
        onReset={() => updateFilters({ q: '', categoryId: '', status: '' })}
      />

      <section
        aria-label="Stock levels"
        className={`overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low transition-opacity ${list.loading && list.data ? 'opacity-60' : ''}`}
      >
        {list.error && list.data && (
          <p role="alert" className="flex items-center justify-between gap-3 border-b border-white/5 bg-error-container/30 px-5 py-2 text-xs text-on-error-container">
            {getApiErrorMessage(list.error)}
            <button type="button" onClick={refresh} className="font-semibold underline">
              Retry
            </button>
          </p>
        )}

        {content}

        <Pagination
          meta={meta}
          noun={meta?.total === 1 ? 'item' : 'items'}
          loading={list.loading}
          onPageChange={(page) => updateFilters({ page })}
        />
      </section>
    </div>
  )
}

export default StockLevelsPage
