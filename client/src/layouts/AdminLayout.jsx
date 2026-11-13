import InternalAccountMenu from '../components/common/InternalAccountMenu'
import { Building2, ChevronRight, DoorOpen, KeyRound, LayoutDashboard, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import AppLogo from '../components/common/AppLogo'
import { useAuth } from '../features/auth/hooks/useAuth'

// Items without `to` are planned admin screens from SCREEN_FLOW §5 that have no route yet.
const BREADCRUMBS = [
  ['/admin/profile', 'My Account'],
  ['/admin/dashboard', 'System overview'],
  ['/admin/rooms', 'Room management'],
  ['/admin/staff-accounts', 'Staff account management'],
  ['/admin/roles', 'Role management'],
]

const navItems = [

  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard', end: true },
  { label: 'Staff Accounts', icon: Users, to: '/admin/staff-accounts', permission: 'account.manage' },
  { label: 'Roles & Permissions', icon: KeyRound, to: '/admin/roles', permission: 'role.view' },
  { label: 'Branches', icon: Building2, to: '/admin/branches', permission: 'branch.manage' },
  { label: 'Rooms', icon: DoorOpen, to: '/admin/rooms', permission: 'room.view' },
]

function SidebarNav({ onNavigate, permissions }) {
  return (
    <nav className="grid gap-1" aria-label="Administration">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        Governance &amp; ops
      </p>
      {navItems.filter(({ permission }) => !permission || permissions.has(permission)).map(({ label, icon: Icon, to, end }) =>
        to ? (
          <NavLink
            key={label}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-primary-container text-white shadow-crimson' : 'text-on-surface hover:bg-surface-container'}`
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ) : (
          <span
            key={label}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-on-surface-variant/60"
          >
            <Icon className="size-4" />
            {label}
            <span className="ml-auto rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase">
              Soon
            </span>
          </span>
        ),
      )}
    </nav>
  )
}

function AdminLayout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { account } = useAuth()
  const permissions = new Set(account?.permissions?.map(({ name }) => name))

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-white/5 bg-surface-container-lowest p-4 lg:flex">
        <div className="px-2 pt-1">
          <AppLogo />
          <p className="mt-1 pl-10 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Administration</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissions={permissions} />
        </div>

      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-white/5 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle administration menu"
              aria-expanded={menuOpen}
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-container lg:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="hidden sm:inline">System administration</span>
              <ChevronRight className="hidden size-3.5 sm:block" />
              <span className="truncate font-semibold text-on-surface">{BREADCRUMBS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Cinema branch management'}</span>
            </nav>
          </div>

          <InternalAccountMenu profilePath="/admin/profile" />
        </header>

        {menuOpen && (
          <div className="grid gap-4 border-b border-white/5 bg-surface-container-lowest p-4 lg:hidden">
            <SidebarNav permissions={permissions} onNavigate={() => setMenuOpen(false)} />

          </div>
        )}

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
