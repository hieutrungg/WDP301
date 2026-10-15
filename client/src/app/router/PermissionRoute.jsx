import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'

// `role` covers use cases owned by one actor: ADMIN holds every permission, so a permission
// check alone would also let it in. UX only; the API enforces the same rule.
function PermissionRoute({ permission, role }) {
  const { account } = useAuth()
  const hasPermission =
    !permission || account?.permissions?.some((item) => item.name === permission)
  const hasRole = !role || account?.roles?.some((item) => item.name === role)

  return hasPermission && hasRole ? <Outlet /> : <Navigate to="/" replace />
}

export default PermissionRoute
