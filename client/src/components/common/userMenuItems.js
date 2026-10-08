import { History, Ticket, UserRound } from 'lucide-react'

// Items without `to` are planned screens (C16 / transaction history) that have no route yet.
export const userMenuItems = [
  { label: 'My Profile', to: '/profile', icon: UserRound },
  { label: 'My Tickets', icon: Ticket },
  { label: 'Booking History', icon: History },
]
