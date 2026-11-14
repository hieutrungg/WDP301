import BookingHistoryPage from './BookingHistoryPage'
import MyTicketsPage from './MyTicketsPage'

// /my-tickets lists the tickets that can still be used; /booking-history lists every booking.
// The router mounts this page for both paths with `initialMode`.
function CustomerBookingsPage({ initialMode = 'tickets' }) {
  return initialMode === 'history' ? <BookingHistoryPage /> : <MyTicketsPage />
}

export default CustomerBookingsPage
