export const ROLE_PRIORITY = ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']

const ROLE_HOME = [
  { role: 'ADMIN', path: '/admin' },
  { role: 'MANAGER', path: '/manager' },
  { role: 'STAFF', path: '/staff' },
  { role: 'CUSTOMER', path: '/' },
]

const NON_DESTINATION_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/403',
])

const ROLE_PREFIX_RULES = [
  { prefix: '/admin', role: 'ADMIN' },
  { prefix: '/manager', role: 'MANAGER' },
  { prefix: '/staff', role: 'STAFF' },
]

export function getAccountRoleNames(account) {
  return new Set(
    (account?.roles ?? [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean),
  )
}

export function getAccountPermissionNames(account) {
  return new Set(
    (account?.permissions ?? [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean),
  )
}

export function getHighestPriorityRole(account) {
  const roleNames = getAccountRoleNames(account)
  return ROLE_PRIORITY.find((role) => roleNames.has(role)) || null
}

export function hasRequiredRole(account, requiredRole) {
  if (!requiredRole || (Array.isArray(requiredRole) && requiredRole.length === 0)) {
    return true
  }

  const roleNames = getAccountRoleNames(account)
  if (Array.isArray(requiredRole)) {
    return requiredRole.some((role) => roleNames.has(role))
  }

  return roleNames.has(requiredRole)
}

export function hasRequiredPermission(account, requiredPermission) {
  if (
    !requiredPermission ||
    (Array.isArray(requiredPermission) && requiredPermission.length === 0)
  ) {
    return true
  }

  const permissionNames = getAccountPermissionNames(account)
  if (Array.isArray(requiredPermission)) {
    return requiredPermission.every((permission) => permissionNames.has(permission))
  }

  return permissionNames.has(requiredPermission)
}

export function getRoleHomePath(account) {
  const highestRole = getHighestPriorityRole(account)
  const matched = ROLE_HOME.find(({ role }) => role === highestRole)
  return matched ? matched.path : '/'
}

export function getRoleWorkspaceMeta(account) {
  const roleNames = getAccountRoleNames(account)
  const permissionNames = getAccountPermissionNames(account)

  if (roleNames.has('ADMIN') && permissionNames.has('branch.manage')) {
    return { role: 'ADMIN', path: '/admin', label: 'Back to Admin Console' }
  }

  if (roleNames.has('MANAGER')) {
    return { role: 'MANAGER', path: '/manager', label: 'Back to Manager Workspace' }
  }

  if (roleNames.has('STAFF')) {
    return { role: 'STAFF', path: '/staff', label: 'Back to Staff Workspace' }
  }

  return {
    role: roleNames.has('CUSTOMER') ? 'CUSTOMER' : null,
    path: '/',
    label: 'Back to Home',
  }
}

function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getLoginDestination(account, requestedPath) {
  const roleNames = getAccountRoleNames(account)
  const homePath = getRoleHomePath(account)
  const normalizedPath =
    typeof requestedPath === 'string'
      ? requestedPath.trim()
      : requestedPath?.pathname?.trim() || ''

  if (
    !normalizedPath ||
    !normalizedPath.startsWith('/') ||
    NON_DESTINATION_PATHS.has(normalizedPath)
  ) {
    return homePath
  }

  const matchedRolePrefix = ROLE_PREFIX_RULES.find(({ prefix }) =>
    matchesPrefix(normalizedPath, prefix),
  )

  if (matchedRolePrefix) {
    return roleNames.has(matchedRolePrefix.role) ? normalizedPath : homePath
  }

  if (homePath !== '/') {
    return matchesPrefix(normalizedPath, homePath) ? normalizedPath : homePath
  }

  return normalizedPath
}
