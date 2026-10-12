import { Building2, ChevronLeft, ChevronRight, RefreshCw, SearchX, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import BranchFormDrawer from '../components/BranchFormDrawer'
import BranchList from '../components/BranchList'
import BranchStatusDialog from '../components/BranchStatusDialog'
import BranchSummaryCards from '../components/BranchSummaryCards'
import BranchToolbar from '../components/BranchToolbar'
import { useBranchList, useBranchSummary } from '../hooks/useBranches'

const PAGE_SIZE = 10
const STATUS_FILTERS = new Set(['ACTIVE', 'INACTIVE'])

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status') ?? ''

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    status: STATUS_FILTERS.has(status) ? status : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading branches">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="grid gap-3 border-t border-white/5 px-5 py-5 first:border-t-0 lg:grid-cols-5">
          {Array.from({ length: 5 }, (__, cell) => (
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

const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

function BranchManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const [refreshToken, setRefreshToken] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  const list = useBranchList({ ...filters, limit: PAGE_SIZE, refreshToken })
  const summary = useBranchSummary(refreshToken)
  const branches = list.data?.items ?? []
  const meta = list.data?.meta

  const refresh = () => setRefreshToken((token) => token + 1)

  const updateFilters = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const params = {}
    if (next.q) params.q = next.q
    if (next.status) params.status = next.status
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params, { replace: true })
  }

  const handleSaved = (branch) => {
    setEditing(null)
    setExpandedId(branch.id)
    refresh()
  }

  const handleStatusChanged = () => {
    setStatusTarget(null)
    refresh()
  }

  const hasFilters = Boolean(filters.q || filters.status)
  const firstItem = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0
  const lastItem = meta ? Math.min(meta.page * meta.limit, meta.total) : 0

  let content
  if (list.loading && !list.data) {
    content = <ListSkeleton />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Branches could not be loaded"
        body={getApiErrorMessage(list.error)}
        action={
          <button type="button" onClick={refresh} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      />
    )
  } else if (branches.length === 0 && filters.page > 1 && meta?.total > 0) {
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
  } else if (branches.length === 0) {
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No branches match these filters"
        body="Try a different name, address, email or hotline, or clear the status filter."
        action={
          <button type="button" onClick={() => updateFilters({ q: '', status: '' })} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage
        icon={Building2}
        title="No branches yet"
        body="Add the first cinema branch so rooms and showtimes can be configured."
      />
    )
  } else {
    content = (
      <BranchList
        branches={branches}
        expandedId={expandedId}
        refreshToken={refreshToken}
        onToggleView={(id) => setExpandedId((current) => (current === id ? null : id))}
        onEdit={setEditing}
        onChangeStatus={setStatusTarget}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary-container" />
            Branch governance
          </p>
          <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
            Cinema Branch Management
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Maintain branch names, addresses and contact points, and control which branches are
            visible to customers. Branches are retired by setting them inactive, never deleted.
          </p>
        </div>
      </section>

      <BranchSummaryCards summary={summary.data} loading={summary.loading} error={summary.error} />

      <BranchToolbar
        query={filters.q}
        status={filters.status}
        summary={summary.data}
        onQueryChange={(q) => updateFilters({ q })}
        onStatusChange={(status) => updateFilters({ status })}
        onReset={() => updateFilters({ q: '', status: '' })}
        onCreate={() => setEditing('new')}
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-secondary/15 bg-secondary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-heading text-sm font-bold text-on-surface">Dependency guard active</p>
            <p className="text-xs text-on-surface-variant">
              A branch with upcoming published showtimes cannot be set to inactive. Use View to
              inspect a branch&apos;s rooms and upcoming showtimes.
            </p>
          </div>
        </div>
      </div>

      <section
        aria-label="Branches"
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

        {meta && meta.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-white/5 px-5 py-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {firstItem}–{lastItem} of {meta.total} {meta.total === 1 ? 'branch' : 'branches'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateFilters({ page: meta.page - 1 })}
                disabled={meta.page <= 1 || list.loading}
                aria-label="Previous page"
                className={`${secondaryButton} px-2.5 py-2`}
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-20 text-center">
                Page {meta.page} of {Math.max(meta.totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => updateFilters({ page: meta.page + 1 })}
                disabled={meta.page >= meta.totalPages || list.loading}
                aria-label="Next page"
                className={`${secondaryButton} px-2.5 py-2`}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {editing && (
        <BranchFormDrawer
          branch={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {statusTarget && (
        <BranchStatusDialog
          branch={statusTarget}
          onClose={() => setStatusTarget(null)}
          onChanged={handleStatusChanged}
        />
      )}
    </div>
  )
}

export default BranchManagementPage
