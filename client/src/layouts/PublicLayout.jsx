import { Outlet } from 'react-router'
import Footer from '../components/common/Footer'
import Header from '../components/common/Header'

// Used as a route layout (renders the matched child) or directly with children.
function PublicLayout({ children }) {
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
