import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'
import {
  hasRequiredPermission,
  hasRequiredRole,
} from '../../features/auth/utils/loginDestination'
import PublicLayout from '../../layouts/PublicLayout'
import ForbiddenPage from '../../pages/public/ForbiddenPage'
import NotFoundPage from '../../pages/public/NotFoundPage'

const INTERNAL_ROLES = ['ADMIN', 'MANAGER', 'STAFF']

const isInternalArea = (role) =>
  (Array.isArray(role) ? role : [role]).some((name) => INTERNAL_ROLES.includes(name))

function PermissionRoute({ permission, role }) {
  const { account, initialized, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!initialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-on-surface-variant">
        Restoring your session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const allowedByRole = hasRequiredRole(account, role)
  const allowedByPermission = hasRequiredPermission(account, permission)

  if (!allowedByRole || !allowedByPermission) {
    // A customer opening /admin, /manager or /staff gets the same page as an unknown URL, so the
    // internal workspaces are not confirmed to exist. Internal accounts in the wrong area still see
    // the 403 page (PLAT-003).
    if (isInternalArea(role) && !hasRequiredRole(account, INTERNAL_ROLES)) {
      return (
        <PublicLayout>
          <NotFoundPage />
        </PublicLayout>
      )
    }
    return <ForbiddenPage standalone={Boolean(role)} />
  }

  return <Outlet />
}

export default PermissionRoute
