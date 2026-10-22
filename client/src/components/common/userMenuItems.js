import { Armchair, Building2, BriefcaseBusiness, DoorOpen, History, Ticket, UserRound } from 'lucide-react'

// Items without `to` are planned screens (C16 / transaction history) that have no route yet.
// `permission` / `role` only hide navigation; the API still enforces access.
export const userMenuItems = [
  { label: 'My Profile', to: '/profile', icon: UserRound },
  { label: 'My Tickets', icon: Ticket },
  { label: 'Booking History', icon: History },
  // Way back to the role workspace from the public pages (home is no longer a forced redirect).
  { label: 'Manager Workspace', to: '/manager', icon: BriefcaseBusiness, role: 'MANAGER' },
  { label: 'Staff Workspace', to: '/staff', icon: BriefcaseBusiness, role: 'STAFF' },
  { label: 'Branch Management', to: '/admin/branches', icon: Building2, permission: 'branch.manage', role: 'ADMIN' },
  { label: 'Room Management', to: '/admin/rooms', icon: DoorOpen, permission: 'room.view', role: 'ADMIN' },
  { label: 'Room Management', to: '/manager/rooms', icon: DoorOpen, permission: 'room.manage', role: 'MANAGER' },
  { label: 'Room Seat Maps', to: '/manager/seat-maps', icon: Armchair, permission: 'room.manage', role: 'MANAGER' },
]

export const getUserMenuItems = (account) =>
  userMenuItems.filter(
    ({ permission, role }) =>
      (!permission || account?.permissions?.some(({ name }) => name === permission)) &&
      (!role || account?.roles?.some(({ name }) => name === role)),
  )
