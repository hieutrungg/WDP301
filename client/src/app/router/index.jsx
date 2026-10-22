import { useLayoutEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import ChangePasswordPage from '../../features/account/pages/ChangePasswordPage'
import EditProfilePage from '../../features/account/pages/EditProfilePage'
import ProfilePage from '../../features/account/pages/ProfilePage'
import BranchManagementPage from '../../features/branch/pages/BranchManagementPage'
import RoomManagementPage from '../../features/room/pages/RoomManagementPage'
import SeatMapConfigPage from '../../features/room/pages/SeatMapConfigPage'
import ManagerShowtimesPage from '../../features/manager-showtimes/pages/ManagerShowtimesPage'
import AddMoviePage from '../../features/manager-movies/pages/AddMoviePage'
import UpdateMoviePage from '../../features/manager-movies/pages/UpdateMoviePage'
import ManagerMoviesPage from '../../features/manager-movies/pages/ManagerMoviesPage'
import MovieManagementAccess from '../../features/manager-movies/components/MovieManagementAccess'
import AdminLayout from '../../layouts/AdminLayout'
import ManagerLayout from '../../layouts/ManagerLayout'
import PublicLayout from '../../layouts/PublicLayout'
import ForbiddenPage from '../../pages/public/ForbiddenPage'
import LandingPage from '../../pages/public/LandingPage'
import LoginPage from '../../pages/public/LoginPage'
import RegisterPage from '../../pages/public/RegisterPage'
import VerifyEmailPage from '../../pages/public/VerifyEmailPage'
import ForgotPasswordPage from '../../pages/public/ForgotPasswordPage'
import ShowtimesPage from '../../features/movie-showtime/pages/ShowtimesPage'
import PermissionRoute from './PermissionRoute'
import MoviesPage from '../../pages/public/MoviesPage'
import MovieDetailPage from '../../pages/public/MovieDetailPage'
import ProtectedRoute from './ProtectedRoute'
import StaffLayout from '../../layouts/StaffLayout'
import CounterPosPage from '../../features/counter-pos/pages/CounterPosPage'
import CounterPaymentPage from '../../features/counter-pos/pages/CounterPaymentPage'
import CounterCompletePage from '../../features/counter-pos/pages/CounterCompletePage'
import SeatSelectionPage from '../../features/seat-selection/pages/SeatSelectionPage'
import CheckoutPage from '../../features/booking/pages/CheckoutPage'
import BookingConfirmationPage from '../../features/booking/pages/BookingConfirmationPage'
import CustomerBookingsPage from '../../features/booking/pages/CustomerBookingsPage'
import StockInPage from '../../features/inventory/pages/StockInPage'
import StockLevelsPage from '../../features/inventory/pages/StockLevelsPage'
import StaffShiftsPage from '../../features/staff-shifts/pages/StaffShiftsPage'

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          {/* Home stays reachable for every role (logo link). Role redirect (A-16) happens on login only. */}
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="403" element={<ForbiddenPage />} />
          <Route path="showtimes" element={<ShowtimesPage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="movies/:movieId" element={<MovieDetailPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="my-tickets"
              element={<CustomerBookingsPage key="my-tickets" initialMode="tickets" />}
            />
            <Route
              path="booking-history"
              element={<CustomerBookingsPage key="booking-history" initialMode="history" />}
            />
            <Route path="booking/:showtimeId/seats" element={<SeatSelectionPage />} />
            <Route path="booking/:showtimeId/checkout" element={<CheckoutPage />} />
            <Route
              path="booking/:showtimeId/confirmation/:bookingId"
              element={<BookingConfirmationPage />}
            />
            <Route
              path="bookings/:bookingId/confirmation"
              element={<BookingConfirmationPage />}
            />
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Route>

        {/* Staff surface has its own shell, like admin/manager. UX guard only; the API enforces
            inventory.view / inventory.stock_in + the STAFF role. */}
        <Route path="staff" element={<ProtectedRoute />}>
          <Route element={<PermissionRoute role="STAFF" />}>
            <Route element={<StaffLayout />}>
              <Route index element={<Navigate to="pos" replace />} />
              <Route path="pos" element={<CounterPosPage />} />
              <Route path="pos/payment" element={<CounterPaymentPage />} />
              <Route path="pos/complete" element={<CounterCompletePage />} />
              <Route element={<PermissionRoute permission="inventory.view" />}>
                <Route path="inventory" element={<StockLevelsPage stockInPath="/staff/inventory/stock-in" />} />
              </Route>
              <Route element={<PermissionRoute permission="inventory.stock_in" />}>
                <Route path="inventory/stock-in" element={<StockInPage backPath="/staff/inventory" />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* UX guard only; the API enforces branch.manage + the ADMIN role on every request. */}
        <Route path="admin" element={<ProtectedRoute />}>
          <Route element={<PermissionRoute permission="branch.manage" role="ADMIN" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="branches" replace />} />
              <Route path="branches" element={<BranchManagementPage />} />
              {/* Read-only for Admin: room writes need the MANAGER role on the API. */}
              <Route element={<PermissionRoute permission="room.view" />}>
                <Route path="rooms" element={<RoomManagementPage readOnly />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* UX guard only; the API enforces room.manage + the MANAGER role on layout writes. */}
        <Route path="manager" element={<ProtectedRoute />}>
          <Route element={<PermissionRoute role="MANAGER" />}>
            <Route element={<ManagerLayout />}>
              <Route index element={<Navigate to="showtimes" replace />} />
              <Route path="showtimes" element={<ManagerShowtimesPage />} />
              <Route element={<MovieManagementAccess />}>
                <Route path="movies" element={<ManagerMoviesPage />} />
                <Route path="movies/:movieId/edit" element={<UpdateMoviePage />} />
              </Route>
              <Route element={<PermissionRoute permission="movie.create" />}>
                <Route path="movies/new" element={<AddMoviePage />} />
              </Route>
              <Route element={<PermissionRoute permission="inventory.view" />}>
                <Route path="inventory" element={<StockLevelsPage />} />
              </Route>
              <Route element={<PermissionRoute permission="room.manage" />}>
                <Route path="rooms" element={<RoomManagementPage />} />
                <Route path="seat-maps" element={<SeatMapConfigPage />} />
              </Route>
              {/* UX guard only; the API enforces shift.view / shift.manage + the MANAGER role. */}
              <Route element={<PermissionRoute permission="shift.view" />}>
                <Route path="staff-shifts" element={<StaffShiftsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
