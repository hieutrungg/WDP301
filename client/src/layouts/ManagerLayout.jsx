import {
  Armchair,
  Boxes,
  CalendarClock,
  ChartLine,
  ChevronRight,
  Film,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  TicketPercent,
  UsersRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import AppLogo from '../components/common/AppLogo'
import { useAuth } from '../features/auth/hooks/useAuth'

// Items without `to` are planned manager screens from SCREEN_FLOW §4 that have no route yet.
// `permission` only hides navigation; the API still enforces access.
const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Movies', icon: Film },
  { label: 'Showtimes', icon: CalendarClock, to: '/manager/showtimes' },
  { label: 'Seat Maps', icon: Armchair, to: '/manager/seat-maps', permission: 'room.manage' },
  { label: 'Concession Stock', icon: Boxes, to: '/manager/inventory', permission: 'inventory.view' },
  { label: 'Promotions', icon: TicketPercent },
  { label: 'Staff Shifts', icon: UsersRound },
  { label: 'Reports', icon: ChartLine },
]

function SidebarNav({ permissions, onNavigate }) {
  return (
    <nav className="grid gap-1" aria-label="Manager operations">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
        Operational hub
      </p>
      {navItems
        .filter(({ permission }) => !permission || permissions.has(permission))
        .map(({ label, icon: Icon, to }) =>
          to ? (
            <NavLink
              key={label}
              to={to}
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

function ManagerLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { account, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const displayName = account?.profile?.fullName || account?.username || ''
  const roleLabel = account?.roles?.map(({ name }) => name).join(', ')
  const permissions = new Set(account?.permissions?.map(({ name }) => name))
  const showtimePage = location.pathname.startsWith('/manager/showtimes')
  const inventoryPage = location.pathname.startsWith('/manager/inventory')
  let breadcrumb = ['Auditorium settings', 'Configure room seat maps']
  if (showtimePage) breadcrumb = ['Schedule & programming', 'Showtime management']
  if (inventoryPage) breadcrumb = ['Concession & inventory', 'Concession stock levels']

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await logout()
      toast.success('Signed out successfully')
      navigate('/', { replace: true })
    } catch {
      toast.error('Unable to sign out. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const footer = (
    <div className="grid gap-1 border-t border-white/5 pt-3">
      <Link
        to="/"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <House className="size-4" />
        Back to website
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary-container/15 disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut className="size-4" />
        {isLoggingOut ? 'Signing out...' : 'Logout'}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-on-surface lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-white/5 bg-surface-container-lowest p-4 lg:flex">
        <div className="px-2 pt-1">
          <AppLogo />
          <p className="mt-1 pl-10 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Theatrical suite</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissions={permissions} />
        </div>
        {footer}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-white/5 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle manager menu"
              aria-expanded={menuOpen}
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-container lg:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="hidden sm:inline">Operational hub</span>
              <ChevronRight className="hidden size-3.5 sm:block" />
              <span className="hidden sm:inline">{breadcrumb[0]}</span>
              <ChevronRight className="hidden size-3.5 sm:block" />
              <span className="truncate font-semibold text-primary">{breadcrumb[1]}</span>
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
              {roleLabel && <p className="truncate text-[11px] font-bold uppercase text-secondary">{roleLabel}</p>}
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {menuOpen && (
          <div className="grid gap-4 border-b border-white/5 bg-surface-container-lowest p-4 lg:hidden">
            <SidebarNav permissions={permissions} onNavigate={() => setMenuOpen(false)} />
            {footer}
          </div>
        )}

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default ManagerLayout
