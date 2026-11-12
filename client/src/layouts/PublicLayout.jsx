import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/hooks/useAuth'
import { getHighestPriorityRole, getRoleHomePath } from '../features/auth/utils/loginDestination'
import Footer from '../components/common/Footer'
import Header from '../components/common/Header'

// Used as a route layout (renders the matched child) or directly with children.
function PublicLayout({ children }) {
  const { account, initialized } = useAuth()
  const { pathname } = useLocation()

  if (!initialized) return <div className="min-h-screen bg-background" />

  // Keep the access-denied destination reachable to avoid redirect loops.
  if (account && pathname !== '/403') {
    const role = getHighestPriorityRole(account)
    if (role !== 'CUSTOMER') {
      return <Navigate to={role ? getRoleHomePath(account) : '/403'} replace />
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      <Header />
      <main>
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  )
}

export default PublicLayout
