import { useLocation } from 'react-router'

export function useAccountNavigation() {
  const { pathname } = useLocation()
  const workspace = pathname.match(/^\/(admin|manager|staff)(?:\/|$)/)?.[1]
  return {
    profilePath: workspace ? `/${workspace}/profile` : '/profile',
    homePath: workspace ? `/${workspace}/dashboard` : '/',
    accountLabel: workspace ? 'Personal Account' : 'Customer Account',
    portalLabel: workspace ? `${workspace[0].toUpperCase()}${workspace.slice(1)} Portal` : 'Customer Portal',
    internal: Boolean(workspace),
  }
}
