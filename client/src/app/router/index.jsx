import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import ProfilePage from '../../features/account/pages/ProfilePage'
import BranchManagementPage from '../../features/branch/pages/BranchManagementPage'
import AdminLayout from '../../layouts/AdminLayout'
import PublicLayout from '../../layouts/PublicLayout'
import LandingPage from '../../pages/public/LandingPage'
import LoginPage from '../../pages/public/LoginPage'
import RegisterPage from '../../pages/public/RegisterPage'
import VerifyEmailPage from '../../pages/public/VerifyEmailPage'
import ShowtimesPage from '../../features/movie-showtime/pages/ShowtimesPage'
import PermissionRoute from './PermissionRoute'
import ProtectedRoute from './ProtectedRoute'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="showtimes" element={<ShowtimesPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* UX guard only; the API enforces branch.manage on every request. */}
        <Route path="admin" element={<ProtectedRoute />}>
          <Route element={<PermissionRoute permission="branch.manage" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="branches" replace />} />
              <Route path="branches" element={<BranchManagementPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
