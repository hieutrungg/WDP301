import { Building2, History, Ticket, UserRound } from 'lucide-react'

// Items without `to` are planned screens (C16 / transaction history) that have no route yet.
// `permission` only hides navigation; the API still enforces access.
export const userMenuItems = [
  { label: 'My Profile', to: '/profile', icon: UserRound },
  { label: 'My Tickets', icon: Ticket },
  { label: 'Booking History', icon: History },
  { label: 'Branch Management', to: '/admin/branches', icon: Building2, permission: 'branch.manage' },
]

export const getUserMenuItems = (account) =>
  userMenuItems.filter(
    ({ permission }) => !permission || account?.permissions?.some(({ name }) => name === permission),
  )
