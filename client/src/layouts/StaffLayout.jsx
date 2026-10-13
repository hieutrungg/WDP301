import { NavLink, Outlet } from 'react-router'
import { LayoutDashboard, ScanLine, Ticket, UserRound } from 'lucide-react'
import AppLogo from '../components/common/AppLogo'

const items = [{ to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/staff/pos', label: 'Sell Tickets', icon: Ticket }, { to: '/staff/tickets/scan', label: 'Scan Ticket', icon: ScanLine }]

function StaffLayout() {
  return <div className="min-h-screen bg-surface text-on-surface lg:pl-64"><aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-surface-container-low lg:flex"><div className="border-b border-surface-container-high bg-surface-container-lowest p-5"><AppLogo /><p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">Staff operations</p></div><nav className="flex-1 space-y-1 p-3">{items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-primary-container text-white shadow-crimson' : 'text-tertiary hover:bg-surface-container-high hover:text-on-surface'}`}><Icon className="size-5" />{label}</NavLink>)}</nav><div className="m-3 flex items-center gap-2 rounded-lg bg-surface-container p-3 text-sm"><UserRound className="size-5 text-primary" /><span>Staff session</span></div></aside><header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-surface-container-high bg-surface-container/95 px-5 backdrop-blur lg:px-7"><span className="font-heading font-bold">Landmark 81 · Counter #02</span><span className="text-sm text-secondary">Online</span></header><main className="min-h-[calc(100vh-4rem)] p-4 lg:p-7"><Outlet /></main></div>
}

export default StaffLayout
