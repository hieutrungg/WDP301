import { ChevronLeft, ChevronRight, DoorOpen, Eye, Grid3x3, RefreshCw, SearchX, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import RoomDeleteDialog from '../components/RoomDeleteDialog'
import RoomFormDrawer from '../components/RoomFormDrawer'
import RoomList from '../components/RoomList'
import RoomStatusDialog from '../components/RoomStatusDialog'
import RoomSummaryCards from '../components/RoomSummaryCards'
import RoomToolbar from '../components/RoomToolbar'
import { useActiveBranches, useManagedRoomList, useRoomSummary } from '../hooks/useRooms'
import { ROOM_STATUSES } from '../schema/roomSchema'
import { pluralize } from '../utils/roomFormat'
import { SORT_OPTIONS } from '../utils/roomOptions'

const PAGE_SIZE = 10
const SORT_VALUES = new Set(SORT_OPTIONS.map(({ value }) => value))
const OBJECT_ID = /^[a-f\d]{24}$/i

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status') ?? ''
  const branchId = searchParams.get('branch') ?? ''
  const sort = searchParams.get('sort') ?? ''

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    status: ROOM_STATUSES.includes(status) ? status : '',
    roomType: (searchParams.get('type') ?? '').slice(0, 30),
    branchId: OBJECT_ID.test(branchId) ? branchId : '',
    sort: SORT_VALUES.has(sort) ? sort : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading rooms">
      {Array.from({ length: 4 }, (_, index) => (
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

const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

// Managers get full CRUD; Admin opens the same screen read-only (writes also need the MANAGER
// role on the API, so the hidden controls are a UX choice, not the security boundary).
function RoomManagementPage({ readOnly = false }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const [refreshToken, setRefreshToken] = useState(0)
  const [editing, setEditing] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [sort, order] = filters.sort ? filters.sort.split(':') : [undefined, undefined]
  const list = useManagedRoomList({
    q: filters.q,
    status: filters.status,
    roomType: filters.roomType,
    branchId: filters.branchId,
    sort,
    order,
    page: filters.page,
    limit: PAGE_SIZE,
    refreshToken,
  })
  const summary = useRoomSummary(filters.branchId, refreshToken)
  const branchOptions = useActiveBranches()
  const rooms = list.data?.items ?? []
  const meta = list.data?.meta
  const branches = branchOptions.data?.items ?? []

  const refresh = () => setRefreshToken((token) => token + 1)

  const updateFilters = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const params = {}
    if (next.q) params.q = next.q
    if (next.status) params.status = next.status
    if (next.roomType) params.type = next.roomType
    if (next.branchId) params.branch = next.branchId
    if (next.sort) params.sort = next.sort
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params, { replace: true })
  }

  const resetFilters = () => updateFilters({ q: '', status: '', roomType: '', branchId: '', sort: '' })

  const handleSaved = () => {
    setEditing(null)
    refresh()
  }

  const handleStatusChanged = () => {
    setStatusTarget(null)
    refresh()
  }

  const handleDeleted = () => {
    setDeleteTarget(null)
    refresh()
  }

  const hasFilters = Boolean(filters.q || filters.status || filters.roomType || filters.branchId)
  const firstItem = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0
  const lastItem = meta ? Math.min(meta.page * meta.limit, meta.total) : 0
  // Filter options follow the data: every format that exists, plus a format picked from a stale link.
  const roomTypes = [...new Set([...(summary.data?.roomTypes ?? []).map(({ roomType }) => roomType), filters.roomType].filter(Boolean))]

  let content
  if (list.loading && !list.data) {
    content = <ListSkeleton />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Rooms could not be loaded"
        body={getApiErrorMessage(list.error)}
        action={
          <button type="button" onClick={refresh} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      />
    )
  } else if (rooms.length === 0 && filters.page > 1 && meta?.total > 0) {
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
  } else if (rooms.length === 0) {
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No rooms match these filters"
        body="Try a different name, or clear the branch, format and status filters."
        action={
          <button type="button" onClick={resetFilters} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage
        icon={DoorOpen}
        title="No rooms yet"
        body={
          readOnly
            ? 'A manager has not added any rooms yet.'
            : 'Add the first screening room, then configure its seat map so it can be scheduled.'
        }
        action={
          !readOnly && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90"
            >
              Add new room
            </button>
          )
        }
      />
    )
  } else {
    content = (
      <RoomList
        rooms={rooms}
        readOnly={readOnly}
        onEdit={setEditing}
        onChangeStatus={setStatusTarget}
        onDelete={setDeleteTarget}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary-container" />
            {readOnly ? 'Read-only view' : 'Auditorium settings'}
          </p>
          <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
            Room Management
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {readOnly
              ? 'Review screening rooms across branches: formats, seat capacity, status and upcoming programming. Only managers can change them.'
              : 'Create and maintain screening rooms, control whether they can be scheduled, and jump to each room’s seat map. Capacity always comes from the seat map.'}
          </p>
        </div>
        {!readOnly && (
          <Link
            to="/manager/seat-maps"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-bright xl:self-auto"
          >
            <Grid3x3 className="size-4 text-secondary" />
            Seat map editor
          </Link>
        )}
      </section>

      <RoomSummaryCards summary={summary.data} loading={summary.loading} error={summary.error} />

      <RoomToolbar
        filters={filters}
        branches={branches}
        roomTypes={roomTypes}
        summary={summary.data}
        readOnly={readOnly}
        onChange={updateFilters}
        onReset={resetFilters}
        onCreate={() => setEditing('new')}
      />

      <div className="flex items-start gap-3 rounded-2xl border border-secondary/15 bg-secondary/5 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
          {readOnly ? <Eye className="size-5" /> : <ShieldCheck className="size-5" />}
        </span>
        <div>
          <p className="font-heading text-sm font-bold text-on-surface">
            {readOnly ? 'Managers maintain rooms' : 'Dependency guard active'}
          </p>
          <p className="text-xs text-on-surface-variant">
            {readOnly
              ? 'Administrators can review rooms here. Creating, editing, retiring and deleting rooms is done by branch managers.'
              : 'A room with upcoming published showtimes cannot change format or leave service. A room that ever hosted a showtime cannot be deleted; set it to inactive instead.'}
          </p>
        </div>
      </div>

      <section
        aria-label="Rooms"
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
              Showing {firstItem}–{lastItem} of {pluralize(meta.total, 'room')}
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

      {!readOnly && editing && (
        <RoomFormDrawer
          room={editing === 'new' ? null : editing}
          branches={branches}
          branchesLoading={branchOptions.loading && !branchOptions.data}
          branchesError={branchOptions.error && !branchOptions.data ? branchOptions.error : null}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {!readOnly && statusTarget && (
        <RoomStatusDialog room={statusTarget} onClose={() => setStatusTarget(null)} onChanged={handleStatusChanged} />
      )}

      {!readOnly && deleteTarget && (
        <RoomDeleteDialog
          room={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
          onRetire={() => {
            setStatusTarget(deleteTarget)
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default RoomManagementPage
