import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'

function PermissionRoute({ permission }) {
  const { account } = useAuth()
  const hasPermission = account?.permissions?.some(
    (item) => item.name === permission,
  )

  return hasPermission ? <Outlet /> : <Navigate to="/" replace />
}

export default PermissionRoute
