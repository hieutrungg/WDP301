import { Outlet } from 'react-router'
import Footer from '../components/common/Footer'
import Header from '../components/common/Header'

function PublicLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default PublicLayout
