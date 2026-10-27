// Pure helpers for Role Management (UC45-47) and Staff Account Management (UC35-37).

const GROUP_LABELS = {
  account: 'Accounts',
  analytics: 'Analytics',
  booking: 'Bookings',
  branch: 'Branches',
  concession: 'Concessions',
  inventory: 'Inventory',
  movie: 'Movies',
  payment: 'Payments',
  permission: 'Permissions',
  profile: 'Profile',
  promotion: 'Promotions',
  refund: 'Refunds',
  report: 'Reports',
  role: 'Roles',
  room: 'Rooms',
  shift: 'Staff shifts',
  showtime: 'Showtimes',
  staff: 'Staff',
  ticket: 'Tickets',
}

export const SYSTEM_ROLE_NAMES = Object.freeze(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'])

export const STAFF_STATUS_META = Object.freeze({
  ACTIVE: { label: 'Active', tone: 'success' },
  DISABLED: { label: 'Disabled', tone: 'muted' },
  PENDING_VERIFICATION: { label: 'Pending verification', tone: 'warning' },
})

export function getStaffStatusMeta(status) {
  return STAFF_STATUS_META[status] ?? { label: status || 'Unknown', tone: 'muted' }
}

export function permissionGroupOf(name) {
  return String(name ?? '').split('.')[0] || 'other'
}

export function permissionGroupLabel(group) {
  return GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1)
}

// [{ group, label, permissions }] sorted by label, permissions by name; `query` filters by
// name or description.
export function groupPermissions(permissions, query = '') {
  const needle = query.trim().toLowerCase()
  const groups = new Map()

  for (const permission of permissions ?? []) {
    const haystack = `${permission.name} ${permission.description ?? ''}`.toLowerCase()
    if (needle && !haystack.includes(needle)) continue

    const group = permission.group ?? permissionGroupOf(permission.name)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(permission)
  }

  return [...groups.entries()]
    .map(([group, items]) => ({
      group,
      label: permissionGroupLabel(group),
      permissions: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// UC37 step 4a: permissionId -> names of the selected roles that already grant it.
export function inheritedPermissionMap(roles, selectedRoleIds) {
  const selected = new Set(selectedRoleIds ?? [])
  const inherited = new Map()

  for (const role of roles ?? []) {
    if (!selected.has(role.id)) continue
    for (const permissionId of role.permissionIds ?? []) {
      if (!inherited.has(permissionId)) inherited.set(permissionId, [])
      inherited.get(permissionId).push(role.name)
    }
  }

  return inherited
}

export function redundancyLabel(roleNames) {
  if (!roleNames?.length) return ''
  return `Already granted via assigned role (${roleNames.join(', ')})`
}

// Effective permissions = role grants ∪ direct grants (A-08), as a sorted list of ids.
export function effectivePermissionIds(roles, selectedRoleIds, directPermissionIds) {
  const ids = new Set(directPermissionIds ?? [])
  for (const permissionId of inheritedPermissionMap(roles, selectedRoleIds).keys()) ids.add(permissionId)
  return [...ids].sort()
}

export function sameIdSet(left, right) {
  const a = new Set(left ?? [])
  const b = new Set(right ?? [])
  return a.size === b.size && [...a].every((id) => b.has(id))
}

export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

// CR-05 confirmations before saving a role (UC45 5, UC46 5/8, UC47 3/6). `activeAccountCount` is
// 0 for a new role. Returns the confirmations still needed, in the order they are asked.
export function roleSaveConfirmations({ permissionIds, activeAccountCount = 0, changed = true }) {
  const needed = []
  if (permissionIds && permissionIds.length === 0) needed.push('noPermissions')
  if (changed && activeAccountCount > 0) needed.push('affectedAccounts')
  return needed
}

export function affectedAccountsMessage(count) {
  const accounts = count === 1 ? '1 active account' : `${count} active accounts`
  return `This role is assigned to ${accounts}. The change will immediately affect ${count === 1 ? 'it' : 'them'}.`
}

export const NO_PERMISSIONS_MESSAGE =
  'This role will have no access rights. Staff holding only this role will not be able to use any protected feature.'

// dd/MM/yyyy HH:mm in Asia/Ho_Chi_Minh (SRS 4.2.1).
export function formatAdminDateTime(isoValue, fallback = '—') {
  if (!isoValue) return fallback
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return fallback

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

export function personLabel(person) {
  if (!person) return 'System'
  return person.fullName ? `${person.fullName} (@${person.username})` : `@${person.username}`
}

// Only changed fields are sent; "" clears an optional field on the server.
export function changedFields(values, initialValues, fields) {
  return Object.fromEntries(
    fields.filter((field) => values[field] !== initialValues[field]).map((field) => [field, values[field]]),
  )
}

export function getApiErrorCode(error) {
  return error?.response?.data?.code ?? null
}
