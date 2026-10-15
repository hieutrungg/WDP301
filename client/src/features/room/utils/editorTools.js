import { Accessibility, Armchair, Ban, Crown, Eraser, Heart, MousePointer2 } from 'lucide-react'

export const EDITOR_TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2, hint: 'Inspect a position' },
  { id: 'STANDARD', label: 'Standard', shortcut: '1', icon: Armchair, hint: 'Paint Standard seats' },
  { id: 'VIP', label: 'VIP', shortcut: '2', icon: Crown, hint: 'Paint VIP seats' },
  { id: 'DOUBLE_LUXURY', label: 'Double Luxury', shortcut: '3', icon: Heart, hint: 'Paint Double Luxury seats' },
  { id: 'ACCESSIBLE', label: 'Accessible', shortcut: '4', icon: Accessibility, hint: 'Toggle the accessible marker on seats' },
  { id: 'DISABLED', label: 'Blocked', shortcut: '5', icon: Ban, hint: 'Toggle a seat out of service (kept, not sellable)' },
  { id: 'AISLE', label: 'Aisle', shortcut: '6', icon: Eraser, hint: 'Clear positions to blank aisle space' },
]

export const ZOOM_LEVELS = [20, 24, 28, 34, 40]
export const DEFAULT_ZOOM_INDEX = 2
