import { Pencil, Plus, Power, PowerOff, RefreshCw, RotateCcw, SearchX, ShieldCheck, UserCog, Users } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import { changeStaffStatusRequest } from '../api/accessControlApi'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  ListMessage,
  ListPagination,
  ListSkeleton,
  primaryButton,
  RoleChip,
  secondaryButton,
  SortHeader,
  StatusBadge,
} from '../components/ListParts'
import SearchBox from '../components/SearchBox'
import StaffAccessDrawer from '../components/StaffAccessDrawer'
import StaffFormDrawer from '../components/StaffFormDrawer'
import { useRefreshAccessControl, useStaffFormOptions, useStaffList } from '../hooks/useAccessControl'
import { formatAdminDateTime } from '../utils/accessControl'

const PAGE_SIZE = 10
const STATUSES = new Set(['ACTIVE', 'DISABLED'])
const SORTS = new Set(['createdAt', 'username', 'fullName', 'email', 'status'])
const COLUMNS = 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_8rem_auto]'

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status') ?? ''
  const sort = searchParams.get('sort') ?? 'createdAt'
  const roleId = searchParams.get('roleId') ?? ''

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    status: STATUSES.has(status) ? status : '',
    roleId: /^[a-f\d]{24}$/i.test(roleId) ? roleId : '',
    sort: SORTS.has(sort) ? sort : 'createdAt',
    order: searchParams.get('order') === 'asc' ? 'asc' : 'desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function SummaryCards({ counts }) {
  const cards = [
    ['Staff accounts', counts?.total],
    ['Active', counts?.active],
    ['Disabled', counts?.disabled],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/5 bg-surface-container-low p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
          <p className="mt-1 font-heading text-3xl font-bold text-on-surface">{value ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

function StaffRow({ account, isSelf, onEdit, onAccess, onChangeStatus }) {
  const canToggle = account.status === 'ACTIVE' || account.status === 'DISABLED'
  const disablingSelf = isSelf && account.status === 'ACTIVE'

  return (
    <li className={`grid gap-3 border-t border-white/5 px-5 py-4 first:border-t-0 lg:items-center ${COLUMNS}`}>
      <div className="min-w-0">
        <p className="truncate font-semibold text-on-surface">
          {account.fullName ?? account.username}
          {isSelf && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-secondary">You</span>}
        </p>
        <p className="truncate text-xs text-on-surface-variant">
          @{account.username} · {account.email}
        </p>
        <p className="truncate text-xs text-on-surface-variant">{account.phone ?? 'No phone number'}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {account.roles.map((role) => (
          <RoleChip key={role.id} name={role.name} isSystem={role.isSystem} />
        ))}
        {account.directPermissionCount > 0 && (
          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] text-on-surface-variant">
            +{account.directPermissionCount} direct
          </span>
        )}
      </div>
      <div className="min-w-0 text-xs text-on-surface-variant">
        <p className="truncate text-sm text-on-surface">{account.branch?.branchName ?? 'No branch'}</p>
        <p className="truncate">{account.position ?? '—'}</p>
      </div>
      <div>
        <StatusBadge status={account.status} />
      </div>
      <p className="text-xs text-on-surface-variant">{formatAdminDateTime(account.createdAt)}</p>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" onClick={() => onEdit(account)} className={`${secondaryButton} px-3 py-2`} aria-label={`Edit ${account.username}`}>
          <Pencil className="size-4" />
          Edit
        </button>
        <button type="button" onClick={() => onAccess(account)} className={`${secondaryButton} px-3 py-2`} aria-label={`Roles and permissions of ${account.username}`}>
          <UserCog className="size-4" />
          Access
        </button>
        {canToggle && (
          <button
            type="button"
            onClick={() => onChangeStatus(account)}
            disabled={disablingSelf}
            title={disablingSelf ? 'You cannot disable your own account.' : undefined}
            className={`${secondaryButton} px-3 py-2`}
          >
            {account.status === 'ACTIVE' ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            {account.status === 'ACTIVE' ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
    </li>
  )
}

function StaffAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const { account: currentAccount } = useAuth()
  const [drawer, setDrawer] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const list = useStaffList({
    ...filters,
    q: filters.q || undefined,
    status: filters.status || undefined,
    roleId: filters.roleId || undefined,
    limit: PAGE_SIZE,
  })
  const options = useStaffFormOptions()
  const refreshAll = useRefreshAccessControl()
  const accounts = list.data?.items ?? []
  const meta = list.data?.meta

  const updateFilters = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const params = {}
    if (next.q) params.q = next.q
    if (next.status) params.status = next.status
    if (next.roleId) params.roleId = next.roleId
    if (next.sort !== 'createdAt') params.sort = next.sort
    if (next.order !== 'desc') params.order = next.order
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params, { replace: true })
  }

  const handleSaved = () => {
    setDrawer(null)
    refreshAll()
  }

  const openStatusDialog = (account) => {
    setStatusError('')
    setStatusTarget(account)
  }

  // UC36 alternative: confirmation before the new status is applied.
  const confirmStatus = async () => {
    const nextStatus = statusTarget.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setStatusBusy(true)
    setStatusError('')

    try {
      const result = await changeStaffStatusRequest(statusTarget.id, nextStatus)
      toast.success(result.message, {
        description:
          nextStatus === 'DISABLED'
            ? `@${result.account.username} can no longer sign in.`
            : `@${result.account.username} can sign in again with their current roles.`,
      })
      setStatusTarget(null)
      refreshAll()
    } catch (error) {
      setStatusError(getApiErrorMessage(error))
    } finally {
      setStatusBusy(false)
    }
  }

  const hasFilters = Boolean(filters.q || filters.status || filters.roleId)
  const isSelf = (account) => account?.id === currentAccount?.id

  let content
  if (list.isPending) {
    content = <ListSkeleton label="Loading staff accounts" columns={6} />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Staff accounts could not be loaded"
        body={getApiErrorMessage(list.error)}
        action={
          <button type="button" onClick={() => list.refetch()} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      />
    )
  } else if (accounts.length === 0) {
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No staff accounts match these filters"
        body="Try a different name, username, email or phone number, or clear the filters."
        action={
          <button type="button" onClick={() => updateFilters({ q: '', status: '', roleId: '' })} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage icon={Users} title="No staff accounts yet" body="Create the first staff account and assign it a role." />
    )
  } else {
    const sortProps = { sort: filters.sort, order: filters.order, onSort: (sort, order) => updateFilters({ sort, order }) }
    content = (
      <>
        <div className={`hidden gap-3 border-b border-white/5 px-5 py-3 lg:grid ${COLUMNS}`}>
          <SortHeader label="Staff member" field="fullName" {...sortProps} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Roles</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Branch / position</span>
          <SortHeader label="Status" field="status" {...sortProps} />
          <SortHeader label="Created" field="createdAt" {...sortProps} />
          <span className="text-right text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Actions</span>
        </div>
        <ul>
          {accounts.map((account) => (
            <StaffRow
              key={account.id}
              account={account}
              isSelf={isSelf(account)}
              onEdit={(target) => setDrawer({ kind: 'edit', accountId: target.id })}
              onAccess={(target) => setDrawer({ kind: 'access', accountId: target.id })}
              onChangeStatus={openStatusDialog}
            />
          ))}
        </ul>
      </>
    )
  }

  const disabling = statusTarget?.status === 'ACTIVE'

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 rounded-full bg-primary-container" />
          Access control
        </p>
        <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
          Staff Account Management
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Create staff accounts, keep their details up to date, assign roles and direct permissions,
          and disable accounts that should no longer sign in. Accounts are never deleted.
        </p>
      </section>

      <SummaryCards counts={meta?.counts} />

      <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-surface-container-low p-3 lg:flex-row lg:items-center">
        <SearchBox
          value={filters.q}
          onChange={(q) => updateFilters({ q })}
          placeholder="Search by name, username, email or phone number"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value })}
              className="h-11 rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <select
              value={filters.roleId}
              onChange={(event) => updateFilters({ roleId: event.target.value })}
              className="h-11 rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30"
            >
              <option value="">All roles</option>
              {(options.data?.roles ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => updateFilters({ q: '', status: '', roleId: '' })}
            disabled={!hasFilters}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
          <button type="button" onClick={() => setDrawer({ kind: 'create' })} className={`${primaryButton} h-11`}>
            <Plus className="size-4" strokeWidth={2.5} />
            Create staff account
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-secondary/15 bg-secondary/5 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
          <ShieldCheck className="size-5" />
        </span>
        <p className="text-xs text-on-surface-variant">
          <span className="block font-heading text-sm font-bold text-on-surface">Changes take effect immediately</span>
          A disabled account cannot sign in, and its open session is refused on its next request. Role
          and permission changes apply on the account&apos;s next request.
        </p>
      </div>

      <section
        aria-label="Staff accounts"
        className={`overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}
      >
        {content}
        <ListPagination
          meta={meta}
          noun="staff account"
          pluralNoun="staff accounts"
          busy={list.isFetching}
          onPageChange={(page) => updateFilters({ page })}
        />
      </section>

      {(drawer?.kind === 'create' || drawer?.kind === 'edit') && (
        <StaffFormDrawer
          accountId={drawer.kind === 'edit' ? drawer.accountId : null}
          isSelf={drawer.kind === 'edit' && drawer.accountId === currentAccount?.id}
          blocked={Boolean(statusTarget)}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
          onChangeStatus={openStatusDialog}
        />
      )}

      {drawer?.kind === 'access' && (
        <StaffAccessDrawer
          accountId={drawer.accountId}
          isSelf={drawer.accountId === currentAccount?.id}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

      {statusTarget && (
        <ConfirmDialog
          title={disabling ? 'Disable this staff account?' : 'Enable this staff account?'}
          description={`${statusTarget.fullName ?? statusTarget.username} (@${statusTarget.username})`}
          points={
            disabling
              ? [
                  'The account can no longer sign in until it is enabled again.',
                  'Its open session is refused on its next request.',
                  'Roles, permissions and history are kept. Nothing is deleted.',
                ]
              : ['The account can sign in again with its current roles and permissions.']
          }
          tone={disabling ? 'danger' : 'neutral'}
          icon={disabling ? PowerOff : Power}
          confirmLabel={disabling ? 'Disable account' : 'Enable account'}
          busy={statusBusy}
          error={statusError}
          onCancel={() => setStatusTarget(null)}
          onConfirm={confirmStatus}
        />
      )}
    </div>
  )
}

export default StaffAccountsPage
