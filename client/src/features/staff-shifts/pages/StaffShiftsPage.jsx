import { CalendarPlus, CalendarX2, MapPin, RefreshCw, SearchX, UserRoundX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import AssignShiftDrawer from '../components/AssignShiftDrawer'
import ShiftDashboard from '../components/ShiftDashboard'
import ShiftDetailDrawer from '../components/ShiftDetailDrawer'
import ShiftPagination from '../components/ShiftPagination'
import ShiftTable from '../components/ShiftTable'
import ShiftToolbar from '../components/ShiftToolbar'
import { useShiftDashboard, useShiftList, useStations } from '../hooks/useStaffShifts'
import {
  SHIFT_STATUS_OPTIONS,
  formatDateLabel,
  formatTime,
  isValidLocalDate,
  localDateOf,
} from '../utils/staffShiftFormat'

const PAGE_SIZE = 10
// The dashboard is "live": it refreshes by itself while the page is open.
const DASHBOARD_REFRESH_MS = 30 * 1000

const STATUS_VALUES = new Set(SHIFT_STATUS_OPTIONS)

const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

function readFilters(searchParams, today) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const date = searchParams.get('date') ?? ''
  const status = searchParams.get('status') ?? ''

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    date: isValidLocalDate(date) ? date : today,
    status: STATUS_VALUES.has(status) ? status : '',
    station: (searchParams.get('station') ?? '').slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function toParams(filters, today) {
  const params = {}
  if (filters.q) params.q = filters.q
  if (filters.date !== today) params.date = filters.date
  if (filters.status) params.status = filters.status
  if (filters.station) params.station = filters.station
  if (filters.page > 1) params.page = String(filters.page)
  return params
}

const isNoBranch = (error) => error?.response?.data?.code === 'BRANCH_NOT_ASSIGNED'

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading shifts">
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

function PageHeader({ branchName, updatedAt, actions }) {
  return (
    <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary-container" />
          Shift monitoring
        </p>
        <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
          Staff Shift Monitoring
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Follow the planned shifts of your branch, filter them by date, employee, status or work position, and approve
          a finished shift. Attendance (clock-in and clock-out) is not tracked here.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {branchName && (
          <p className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface-container px-3 text-sm font-semibold text-on-surface">
            <MapPin className="size-4 text-secondary" aria-hidden="true" />
            {branchName}
          </p>
        )}
        {updatedAt && <p className="text-xs text-on-surface-variant">Updated {formatTime(updatedAt)}</p>}
        {actions}
      </div>
    </section>
  )
}

// UC38 Monitor Staff Shifts. The Manager sees the live dashboard of their own branch (taken from
// their employee profile), filters the shift history, assigns or cancels a shift and approves a
// finished one. No attendance is tracked.
function StaffShiftsPage() {
  const { account } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refreshToken, setRefreshToken] = useState(0)
  const [dashboardToken, setDashboardToken] = useState(0)
  const [openShiftId, setOpenShiftId] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const today = localDateOf()
  const filters = readFilters(searchParams, today)
  const canManage = account?.permissions?.some(({ name }) => name === 'shift.manage')

  const list = useShiftList({ ...filters, limit: PAGE_SIZE, refreshToken })
  const dashboard = useShiftDashboard(dashboardToken)
  const stations = useStations(refreshToken)
  const items = list.data?.items ?? []
  const meta = list.data?.meta
  const branchName = dashboard.data?.branch?.branchName
  const noBranch = isNoBranch(list.error) || isNoBranch(dashboard.error)

  useEffect(() => {
    const timer = setInterval(() => setDashboardToken((token) => token + 1), DASHBOARD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const refresh = () => {
    setRefreshToken((token) => token + 1)
    setDashboardToken((token) => token + 1)
  }

  const updateFilters = (changes) => {
    setSearchParams(toParams({ ...filters, page: 1, ...changes }, today), { replace: true })
  }

  const closeShift = useCallback(() => setOpenShiftId(null), [])
  const closeAssign = useCallback(() => setAssigning(false), [])
  const hasFilters = Boolean(filters.q || filters.status || filters.station)

  // An account without a branch cannot use any part of the screen; say so once, clearly.
  if (noBranch) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader />
        <section className="overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low">
          <ListMessage
            icon={UserRoundX}
            title="Your account is not assigned to a branch"
            body="Shifts are shown for the branch you work at. Ask an administrator to assign a branch to your account, then reload this page."
            action={
              <button type="button" onClick={refresh} className={secondaryButton}>
                <RefreshCw className="size-4" />
                Try again
              </button>
            }
          />
        </section>
      </div>
    )
  }

  let content
  if (list.loading && !list.data) {
    content = <ListSkeleton />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Shifts could not be loaded"
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
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No shifts match these filters"
        body="Try a different employee name, or clear the status and position filters."
        action={
          <button type="button" onClick={() => updateFilters({ q: '', status: '', station: '' })} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage
        icon={CalendarX2}
        title="No shifts on this date"
        body={`There are no shifts for ${formatDateLabel(filters.date)}${branchName ? ` at ${branchName}` : ''}. Pick another date to look at earlier or later shifts.`}
        action={
          canManage ? (
            <button type="button" onClick={() => setAssigning(true)} className={secondaryButton}>
              <CalendarPlus className="size-4" />
              Assign a shift
            </button>
          ) : null
        }
      />
    )
  } else {
    content = <ShiftTable items={items} onOpen={setOpenShiftId} />
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        branchName={branchName}
        updatedAt={dashboard.data?.generatedAt}
        actions={
          <>
            <button type="button" onClick={refresh} className={secondaryButton}>
              <RefreshCw className="size-4" />
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setAssigning(true)}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90"
              >
                <CalendarPlus className="size-4" strokeWidth={2.5} />
                Assign shift
              </button>
            )}
          </>
        }
      />

      <ShiftDashboard dashboard={dashboard} onRetry={() => setDashboardToken((token) => token + 1)} />

      <ShiftToolbar
        filters={filters}
        today={today}
        stations={stations.data}
        onChange={updateFilters}
        onReset={() => updateFilters({ q: '', date: today, status: '', station: '' })}
      />

      <section
        aria-label="Shifts"
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

        <ShiftPagination meta={meta} loading={list.loading} onPageChange={(page) => updateFilters({ page })} />
      </section>

      {openShiftId && <ShiftDetailDrawer key={openShiftId} shiftId={openShiftId} onClose={closeShift} onChanged={refresh} />}
      {assigning && (
        <AssignShiftDrawer
          branchName={branchName}
          onClose={closeAssign}
          onCreated={() => {
            setAssigning(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default StaffShiftsPage
