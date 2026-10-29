import {
  ArrowRight,
  Building2,
  DoorOpen,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getBranchSummaryRequest } from '../../branch/api/branchApi'
import { listRolesRequest, listStaffAccountsRequest } from '../../access-control/api/accessControlApi'

function MetricCard({ title, value, detail, icon: Icon, to, query, accent = 'text-on-surface' }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{title}</p>
        <Icon className={`size-5 ${accent}`} aria-hidden="true" />
      </div>
      {query.isPending ? (
        <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-surface-container-high" aria-label={`Loading ${title}`} />
      ) : query.isError ? (
        <p className="mt-3 text-sm font-semibold text-error">Unavailable</p>
      ) : (
        <p className={`mt-3 font-heading text-3xl font-extrabold ${accent}`}>{value ?? '—'}</p>
      )}
      <p className="mt-1 text-xs text-on-surface-variant">{query.isError ? getApiErrorMessage(query.error) : detail}</p>
      {to && <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-secondary">Open section <ArrowRight className="size-4" /></span>}
    </>
  )

  return to ? (
    <Link to={to} className="block rounded-2xl border border-white/5 bg-surface-container-low p-5 transition hover:border-primary/30 hover:bg-surface-container">
      {content}
    </Link>
  ) : (
    <article className="rounded-2xl border border-white/5 bg-surface-container-low p-5">{content}</article>
  )
}

function QuickLink({ to, title, description, icon: Icon }) {
  return (
    <Link to={to} className="group flex items-start gap-4 rounded-xl bg-surface-container-low p-4 transition hover:bg-surface-container">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container-high text-secondary"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-on-surface-variant">{description}</span>
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-on-surface-variant transition group-hover:translate-x-1 group-hover:text-secondary" aria-hidden="true" />
    </Link>
  )
}

function AdminDashboardPage() {
  const { account } = useAuth()
  const permissions = new Set(account?.permissions?.map(({ name }) => name))
  const canViewBranches = permissions.has('branch.manage')
  const canManageStaff = permissions.has('account.manage')
  const canViewRoles = permissions.has('role.view')
  const canViewRooms = permissions.has('room.view')

  const branches = useQuery({
    queryKey: ['admin-dashboard', 'branch-summary'],
    queryFn: ({ signal }) => getBranchSummaryRequest(signal),
    enabled: canViewBranches,
  })
  const staff = useQuery({
    queryKey: ['admin-dashboard', 'staff-summary'],
    queryFn: ({ signal }) => listStaffAccountsRequest({ page: 1, limit: 1 }, signal),
    enabled: canManageStaff,
  })
  const roles = useQuery({
    queryKey: ['admin-dashboard', 'role-summary'],
    queryFn: ({ signal }) => listRolesRequest({ page: 1, limit: 1 }, signal),
    enabled: canViewRoles,
  })

  const refresh = () => Promise.all([
    canViewBranches ? branches.refetch() : Promise.resolve(),
    canManageStaff ? staff.refetch() : Promise.resolve(),
    canViewRoles ? roles.refetch() : Promise.resolve(),
  ])
  const displayName = account?.profile?.fullName || account?.username || 'Administrator'
  const cards = [
    canViewBranches && {
      key: 'branches', title: 'Cinema branches', value: branches.data?.total,
      detail: branches.data ? `${branches.data.active} active · ${branches.data.inactive} inactive` : 'Branch directory summary',
      icon: Building2, to: '/admin/branches', query: branches, accent: 'text-primary',
    },
    canViewBranches && {
      key: 'rooms', title: 'Cinema rooms', value: branches.data?.roomCount,
      detail: 'Rooms across all branches', icon: DoorOpen,
      to: canViewRooms ? '/admin/rooms' : undefined, query: branches, accent: 'text-secondary',
    },
    canManageStaff && {
      key: 'staff', title: 'Staff accounts', value: staff.data?.meta?.counts?.total,
      detail: staff.data?.meta?.counts ? `${staff.data.meta.counts.active} active · ${staff.data.meta.counts.disabled} disabled` : 'Accounts with staff roles',
      icon: Users, to: '/admin/staff-accounts', query: staff, accent: 'text-tertiary',
    },
    canViewRoles && {
      key: 'roles', title: 'Roles', value: roles.data?.meta?.total,
      detail: 'System and custom roles', icon: KeyRound,
      to: '/admin/roles', query: roles, accent: 'text-secondary',
    },
  ].filter(Boolean)

  const quickLinks = [
    canManageStaff && ['Staff accounts', 'Create accounts and manage staff access.', '/admin/staff-accounts', Users],
    canViewRoles && ['Roles & permissions', 'Review roles and their assigned permissions.', '/admin/roles', KeyRound],
    canViewBranches && ['Branches', 'Manage branch details and operating status.', '/admin/branches', Building2],
    canViewRooms && ['Rooms', 'Review cinema rooms and their branch assignments.', '/admin/rooms', DoorOpen],
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="rounded-2xl border border-white/5 bg-gradient-to-br from-surface-container-low to-surface-container-lowest p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary"><ShieldCheck className="size-4" /> System administration</p>
            <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-on-surface-variant">Welcome, {displayName}. Review system access and cinema structure.</p>
          </div>
          <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-container-highest">
            <RefreshCw className={`size-4 ${[branches, staff, roles].some((query) => query.isFetching) ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      <section aria-labelledby="admin-overview-heading">
        <div className="mb-4">
          <h2 id="admin-overview-heading" className="font-heading text-xl font-bold">System overview</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Summary cards only include data your account is allowed to view.</p>
        </div>
        {cards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => <MetricCard key={card.key} {...card} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-5 text-sm text-on-surface-variant">No overview metrics are available for your current permissions.</div>
        )}
      </section>

      <section aria-labelledby="admin-actions-heading">
        <div className="mb-4">
          <h2 id="admin-actions-heading" className="font-heading text-xl font-bold">Administration</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Open a management area to make changes.</p>
        </div>
        {quickLinks.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {quickLinks.map(([title, description, to, icon]) => <QuickLink key={to} {...{ title, description, to, icon }} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-5 text-sm text-on-surface-variant">No administration tools are available for your current permissions.</div>
        )}
      </section>
    </div>
  )
}

export default AdminDashboardPage
