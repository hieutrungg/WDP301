import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'

function ProtectedRoute() {
  const { isAuthenticated, initialized } = useAuth()
  const location = useLocation()

  if (!initialized) {
    return <div className="min-h-screen bg-background" />
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  )
}

export default ProtectedRoute
