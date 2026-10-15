import { Navigate } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { getLoginDestination } from '../../features/auth/utils/loginDestination'
import LandingPage from '../../pages/public/LandingPage'

function RoleHomeRoute() {
  const { account, initialized } = useAuth()

  if (!initialized) return <div className="min-h-screen bg-background" />
  if (!account) return <LandingPage />

  const destination = getLoginDestination(account)
  return destination === '/' ? <LandingPage /> : <Navigate to={destination} replace />
}

export default RoleHomeRoute
