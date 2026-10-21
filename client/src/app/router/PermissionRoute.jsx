import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'
import {
  hasRequiredPermission,
  hasRequiredRole,
} from '../../features/auth/utils/loginDestination'
import ForbiddenPage from '../../pages/public/ForbiddenPage'

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
    return <ForbiddenPage standalone={Boolean(role)} />
  }

  return <Outlet />
}

export default PermissionRoute
