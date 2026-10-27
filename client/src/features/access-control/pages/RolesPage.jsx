import { KeyRound, Lock, Pencil, Plus, RefreshCw, RotateCcw, SearchX, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import RoleFormDrawer from '../components/RoleFormDrawer'
import SearchBox from '../components/SearchBox'
import {
  ListMessage,
  ListPagination,
  ListSkeleton,
  primaryButton,
  RoleChip,
  secondaryButton,
  SortHeader,
} from '../components/ListParts'
import { useRefreshAccessControl, useRoleList } from '../hooks/useAccessControl'
import { formatAdminDateTime } from '../utils/accessControl'

const PAGE_SIZE = 10
const KINDS = new Set(['system', 'custom'])
const SORTS = new Set(['name', 'createdAt', 'updatedAt'])

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const kind = searchParams.get('kind') ?? ''
  const sort = searchParams.get('sort') ?? 'name'

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    kind: KINDS.has(kind) ? kind : '',
    sort: SORTS.has(sort) ? sort : 'name',
    order: searchParams.get('order') === 'desc' ? 'desc' : 'asc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function RoleRow({ role, onEdit, onPermissions }) {
  return (
    <li className="grid gap-3 border-t border-white/5 px-5 py-4 first:border-t-0 lg:grid-cols-[minmax(0,1.6fr)_7rem_8rem_10rem_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <RoleChip name={role.name} isSystem={role.isSystem} />
          {role.isSystem && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">System role</span>
          )}
          {role.isLocked && <Lock className="size-3.5 text-on-surface-variant" aria-label="Locked" />}
        </div>
        <p className="mt-1 truncate text-sm text-on-surface-variant">{role.description || 'No description'}</p>
      </div>
      <p className="text-sm text-on-surface">
        <span className="font-semibold">{role.permissionCount}</span>
        <span className="text-on-surface-variant lg:hidden"> permissions</span>
      </p>
      <p className="text-sm text-on-surface">
        <span className="font-semibold">{role.activeAccountCount}</span>
        <span className="text-on-surface-variant lg:hidden"> active accounts</span>
      </p>
      <p className="text-xs text-on-surface-variant">{formatAdminDateTime(role.updatedAt)}</p>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" onClick={() => onEdit(role)} className={`${secondaryButton} px-3 py-2`}>
          {role.isLocked ? <Lock className="size-4" /> : <Pencil className="size-4" />}
          {role.isLocked ? 'View' : 'Edit'}
        </button>
        {!role.isLocked && (
          <button type="button" onClick={() => onPermissions(role)} className={`${secondaryButton} px-3 py-2`}>
            <KeyRound className="size-4" />
            Permissions
          </button>
        )}
      </div>
    </li>
  )
}

function RolesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const [drawer, setDrawer] = useState(null)
  const list = useRoleList({ ...filters, q: filters.q || undefined, kind: filters.kind || undefined, limit: PAGE_SIZE })
  const refreshAll = useRefreshAccessControl()
  const roles = list.data?.items ?? []
  const meta = list.data?.meta

  const updateFilters = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const params = {}
    if (next.q) params.q = next.q
    if (next.kind) params.kind = next.kind
    if (next.sort !== 'name') params.sort = next.sort
    if (next.order !== 'asc') params.order = next.order
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params, { replace: true })
  }

  const handleSaved = () => {
    setDrawer(null)
    refreshAll()
  }

  const hasFilters = Boolean(filters.q || filters.kind)

  let content
  if (list.isPending) {
    content = <ListSkeleton label="Loading roles" />
  } else if (list.error && !list.data) {
    content = (
      <ListMessage
        icon={RefreshCw}
        title="Roles could not be loaded"
        body={getApiErrorMessage(list.error)}
        action={
          <button type="button" onClick={() => list.refetch()} className={secondaryButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      />
    )
  } else if (roles.length === 0) {
    content = hasFilters ? (
      <ListMessage
        icon={SearchX}
        title="No roles match these filters"
        body="Try a different name or description, or clear the filters."
        action={
          <button type="button" onClick={() => updateFilters({ q: '', kind: '' })} className={secondaryButton}>
            Clear filters
          </button>
        }
      />
    ) : (
      <ListMessage icon={KeyRound} title="No roles yet" body="Create a role to group permissions for staff accounts." />
    )
  } else {
    content = (
      <>
        <div className="hidden gap-3 border-b border-white/5 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.6fr)_7rem_8rem_10rem_auto]">
          <SortHeader label="Role" field="name" sort={filters.sort} order={filters.order} onSort={(sort, order) => updateFilters({ sort, order })} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Permissions</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Active accounts</span>
          <SortHeader label="Last updated" field="updatedAt" sort={filters.sort} order={filters.order} onSort={(sort, order) => updateFilters({ sort, order })} />
          <span className="text-right text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Actions</span>
        </div>
        <ul>
          {roles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              onEdit={(target) => setDrawer({ mode: 'edit', roleId: target.id })}
              onPermissions={(target) => setDrawer({ mode: 'permissions', roleId: target.id })}
            />
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 rounded-full bg-primary-container" />
          Access control
        </p>
        <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
          Role Management
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          A role defines the base permissions its accounts inherit. Permission changes apply to every
          account holding the role on its next request. Roles are never deleted.
        </p>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-surface-container-low p-3 lg:flex-row lg:items-center">
        <SearchBox value={filters.q} onChange={(q) => updateFilters({ q })} placeholder="Search roles by name or description" />
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Filter by role type</span>
            <select
              value={filters.kind}
              onChange={(event) => updateFilters({ kind: event.target.value })}
              className="h-11 rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/30"
            >
              <option value="">All roles</option>
              <option value="system">System roles</option>
              <option value="custom">Custom roles</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => updateFilters({ q: '', kind: '' })}
            disabled={!hasFilters}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
          <button type="button" onClick={() => setDrawer({ mode: 'create' })} className={`${primaryButton} h-11`}>
            <Plus className="size-4" strokeWidth={2.5} />
            Create role
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-secondary/15 bg-secondary/5 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
          <ShieldCheck className="size-5" />
        </span>
        <p className="text-xs text-on-surface-variant">
          <span className="block font-heading text-sm font-bold text-on-surface">System roles are protected</span>
          ADMIN, MANAGER, STAFF and CUSTOMER cannot be renamed. ADMIN always keeps every permission
          and cannot be edited. Permissions come only from the predefined system list.
        </p>
      </div>

      <section
        aria-label="Roles"
        className={`overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}
      >
        {content}
        <ListPagination
          meta={meta}
          noun="role"
          pluralNoun="roles"
          busy={list.isFetching}
          onPageChange={(page) => updateFilters({ page })}
        />
      </section>

      {drawer && (
        <RoleFormDrawer mode={drawer.mode} roleId={drawer.roleId} onClose={() => setDrawer(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

export default RolesPage
