export const ROOM_STATUS_STYLES = {
  ACTIVE: {
    label: 'Active',
    hint: 'Can be scheduled',
    badge: 'bg-secondary/10 text-secondary ring-secondary/25',
    dot: 'bg-secondary',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    hint: 'Closed for scheduling',
    badge: 'bg-primary-container/15 text-primary ring-primary-container/30',
    dot: 'bg-primary-container',
  },
  INACTIVE: {
    label: 'Inactive',
    hint: 'Retired, history kept',
    badge: 'bg-surface-container-highest text-tertiary ring-white/10',
    dot: 'bg-tertiary-container',
  },
}

// `value` is `<field>:<order>` and is what the page keeps in the URL.
export const SORT_OPTIONS = [
  { value: '', label: 'Branch, then name' },
  { value: 'roomName:asc', label: 'Name A–Z' },
  { value: 'roomName:desc', label: 'Name Z–A' },
  { value: 'capacity:desc', label: 'Most seats' },
  { value: 'capacity:asc', label: 'Fewest seats' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
]
