const ROLE_HOME = [
  { role: 'ADMIN', path: '/admin' },
  { role: 'MANAGER', path: '/manager' },
  { role: 'STAFF', path: '/staff' },
]

export function getLoginDestination(account, requestedPath) {
  const roleNames = new Set((account?.roles ?? []).map(({ name }) => name))
  const home = ROLE_HOME.find(({ role }) => roleNames.has(role))

  if (home) {
    return requestedPath === home.path || requestedPath?.startsWith(`${home.path}/`)
      ? requestedPath
      : home.path
  }

  return requestedPath && requestedPath !== '/login' ? requestedPath : '/'
}
