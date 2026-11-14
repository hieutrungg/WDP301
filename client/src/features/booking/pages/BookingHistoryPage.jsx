import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, History, House, LoaderCircle, RefreshCcw, Ticket } from 'lucide-react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { formatVnDateTime } from '../../ticket/utils/ticketPresentation'
import { listMyBookingPayments } from '../api/paymentApi'
import BookingDetailModal from '../components/BookingDetailModal'
import BookingStatusBadge from '../components/BookingStatusBadge'
import {
  countHistoryFilters,
  getBookingAmount,
  getBookingRef,
  getCinemaName,
  getMovieTitle,
  hasShowtimeEnded,
  HISTORY_FILTERS,
  isPaidBooking,
  matchesHistoryFilter,
  sortHistory,
} from '../utils/customerBookings'
import { getPaymentMethodOption } from '../utils/mockQrCode'

function HistoryRow({ item, now, onOpen }) {
  const { booking, payment, showtime } = item
  const seats = item.seats?.length ? item.seats : booking?.seats || []
  const methodMeta = payment?.method ? getPaymentMethodOption(payment.method) : null
  const watched = isPaidBooking(item) && hasShowtimeEnded(item, now)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-surface-container sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="text-xs text-on-surface-variant">
        <p className="font-semibold text-white">{formatVnDateTime(booking?.bookingTime, '—').split(' ')[0]}</p>
        <p className="font-mono">#{getBookingRef(booking)}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate font-heading text-base font-bold text-white">{getMovieTitle(showtime)}</p>
        <p className="truncate text-xs text-on-surface-variant">
          {formatVnDateTime(showtime?.startAt, 'Scheduled')} · {getCinemaName(showtime)} · {seats.length}{' '}
          {seats.length === 1 ? 'seat' : 'seats'}
          {methodMeta ? ` · ${methodMeta.label}` : ''}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <strong className="font-heading text-lg font-black text-secondary">{formatSeatMoney(getBookingAmount(item))}</strong>
        <div className="flex items-center gap-1.5">
          {watched && <span className="text-[10px] font-semibold uppercase text-on-surface-variant">Ended</span>}
          <BookingStatusBadge item={item} />
        </div>
      </div>
    </button>
  )
}

// C17 Booking History: every booking and payment, newest first, filterable by status. Details
// open in a modal; usable tickets are on My Tickets.
function BookingHistoryPage() {
  const [now] = useState(() => Date.now())
  const [filter, setFilter] = useState('ALL')
  const [selectedItem, setSelectedItem] = useState(null)
  const query = useQuery({ queryKey: ['my-booking-payments'], staleTime: 0, queryFn: listMyBookingPayments })
  const items = sortHistory(query.data?.items)
  const counts = countHistoryFilters(items)
  const visible = items.filter((item) => matchesHistoryFilter(item, filter))
  const totalSpent = items.filter(isPaidBooking).reduce((sum, item) => sum + getBookingAmount(item), 0)

  return (
    <div className="min-h-screen bg-background pb-20 pt-24 text-on-surface">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-on-surface-variant">
          <Link to="/" className="flex items-center gap-1 hover:text-white">
            <House className="size-3.5" />
            Home
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <Link to="/profile" className="hover:text-white">
            Account
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="font-semibold text-white">Booking History</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-black tracking-tight text-white sm:text-4xl">
              <History className="size-7 text-primary" />
              Booking History
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Every booking and payment on your account. Select one to see its details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/my-tickets"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-4 py-2.5 text-xs font-bold text-white hover:border-white/30"
            >
              <Ticket className="size-4" />
              My tickets
            </Link>
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Refresh history"
              className="grid size-10 place-items-center rounded-xl border border-white/15 bg-surface-container text-white hover:border-white/30 disabled:opacity-45"
            >
              <RefreshCcw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {query.isSuccess && (
          <dl className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-surface-container-low p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Bookings</dt>
              <dd className="mt-1 font-heading text-2xl font-black text-white">{counts.ALL}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface-container-low p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Paid</dt>
              <dd className="mt-1 font-heading text-2xl font-black text-emerald-400">{counts.PAID}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface-container-low p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total spent</dt>
              <dd className="mt-1 truncate font-heading text-2xl font-black text-secondary">{formatSeatMoney(totalSpent)}</dd>
            </div>
          </dl>
        )}

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter bookings">
          {HISTORY_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                filter === tab.id
                  ? 'bg-primary text-white'
                  : 'border border-white/10 bg-surface-container-low text-on-surface-variant hover:text-white'
              }`}
            >
              {tab.label}
              {query.isSuccess && <span className="ml-1.5 opacity-70">{counts[tab.id]}</span>}
            </button>
          ))}
        </div>

        {query.isPending && (
          <div role="status" className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-surface-container-low p-12 text-sm">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            Loading your booking history…
          </div>
        )}

        {query.isError && (
          <div role="alert" className="mt-6 rounded-2xl border border-error/40 bg-error/10 p-6 text-center">
            <AlertTriangle className="mx-auto size-8 text-error" />
            <p className="mt-2 font-bold text-white">{getApiErrorMessage(query.error)}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white">
              Try again
            </button>
          </div>
        )}

        {query.isSuccess &&
          (visible.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-surface-container-low p-12 text-center">
              <History className="mx-auto size-12 text-primary/70" />
              <h2 className="mt-4 font-heading text-xl font-bold text-white">No bookings here yet</h2>
              <Link to="/movies" className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white">
                Book a movie
              </Link>
            </div>
          ) : (
            <div className="mt-6 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low">
              {visible.map((item) => (
                <HistoryRow key={item.booking.bookingId} item={item} now={now} onOpen={setSelectedItem} />
              ))}
            </div>
          ))}
      </div>

      <BookingDetailModal item={selectedItem} now={now} onClose={() => setSelectedItem(null)} />
    </div>
  )
}

export default BookingHistoryPage
