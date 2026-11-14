import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, ChevronRight, Clock3, Film, History, House, LoaderCircle, QrCode, RefreshCcw, Ticket, X } from 'lucide-react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { formatScreeningDateTime } from '../../ticket/utils/ticketPresentation'
import { listMyBookingPayments } from '../api/paymentApi'
import BookingTicketsPanel from '../components/BookingTicketsPanel'
import {
  describeStartsIn,
  getBookingRef,
  getCinemaName,
  getMovieTitle,
  getRoomName,
  selectUsableTickets,
} from '../utils/customerBookings'

function TicketQrModal({ item, onClose }) {
  if (!item) return null
  const { booking, showtime } = item
  const when = formatScreeningDateTime(showtime?.startAt)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-qr-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-[#19191c] p-6 text-center text-on-surface shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ticket"
          className="absolute right-4 top-4 rounded-xl border border-white/10 bg-surface-container p-2 text-on-surface-variant hover:text-white"
        >
          <X className="size-4" />
        </button>
        <h2 id="ticket-qr-title" className="pr-10 text-left font-heading text-xl font-black text-white">
          {getMovieTitle(showtime)}
        </h2>
        <p className="mt-1 text-left text-xs text-on-surface-variant">
          {when ? `${when.time} · ${when.date}` : 'Scheduled screening'} · {getCinemaName(showtime)} · {getRoomName(showtime)}
        </p>
        <div className="mt-5 flex flex-col items-center">
          <BookingTicketsPanel bookingId={booking.bookingId} />
        </div>
      </div>
    </div>
  )
}

function TicketStub({ item, now, onOpen }) {
  const { booking, showtime, ticketIssuance } = item
  const seats = item.seats?.length ? item.seats : booking?.seats || []
  const when = formatScreeningDateTime(showtime?.startAt)
  const startsIn = describeStartsIn(item, now)
  const tickets = ticketIssuance?.tickets ?? []
  const validCount = tickets.filter((ticket) => ticket.status === 'ISSUED').length
  const poster = showtime?.movie?.posterUrl

  return (
    <article className="flex overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low shadow-lg transition hover:border-primary/50">
      <div className="relative hidden w-28 shrink-0 bg-surface-container sm:block">
        {poster ? (
          <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Film className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-on-surface-variant" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {startsIn && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              <Clock3 className="size-3" />
              {startsIn}
            </span>
          )}
          {showtime?.movie?.ageRating && (
            <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
              {showtime.movie.ageRating}
            </span>
          )}
        </div>
        <h2 className="truncate font-heading text-xl font-black text-white">{getMovieTitle(showtime)}</h2>
        <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <Building2 className="size-3.5 text-primary" />
          <span className="truncate">
            <strong className="text-white">{getCinemaName(showtime)}</strong> · {getRoomName(showtime)}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {seats.map((seat) => (
            <span
              key={seat.seatId}
              className="rounded border border-primary/40 bg-primary/15 px-2 py-0.5 font-heading text-xs font-extrabold text-white"
            >
              {seat.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tear-off stub: the screening time and the QR button. */}
      <div className="relative flex w-36 shrink-0 flex-col items-center justify-center gap-2 border-l border-dashed border-white/20 bg-[#131315] p-4 text-center sm:w-44">
        <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-background" aria-hidden="true" />
        <span className="absolute -bottom-2.5 -left-2.5 size-5 rounded-full bg-background" aria-hidden="true" />
        <p className="font-heading text-3xl font-black leading-none text-white">{when?.time ?? '--:--'}</p>
        <p className="text-xs font-semibold text-secondary">{when?.date ?? ''}</p>
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-primary/20 hover:brightness-110"
        >
          <QrCode className="size-4" />
          Show QR
        </button>
        <p className="text-[10px] text-on-surface-variant">
          {ticketIssuance?.status === 'ISSUANCE_PENDING' || tickets.length === 0
            ? 'Issuing tickets…'
            : `${validCount}/${tickets.length} valid · #${getBookingRef(booking)}`}
        </p>
      </div>
    </article>
  )
}

// C16 My Tickets: only tickets that can still be used (paid, screening not over, not checked in).
// Finished screenings and every other booking live on Booking History.
function MyTicketsPage() {
  const [now] = useState(() => Date.now())
  const [selectedItem, setSelectedItem] = useState(null)
  const query = useQuery({ queryKey: ['my-booking-payments'], staleTime: 0, queryFn: listMyBookingPayments })
  const tickets = selectUsableTickets(query.data?.items, now)

  return (
    <div className="min-h-screen bg-background pb-20 pt-24 text-on-surface">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-on-surface-variant">
          <Link to="/" className="flex items-center gap-1 hover:text-white">
            <House className="size-3.5" />
            Home
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="font-semibold text-white">My Tickets</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-black tracking-tight text-white sm:text-4xl">
              <Ticket className="size-7 text-primary" />
              My Tickets
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Upcoming tickets ready for entry. Show the QR code at the cinema door.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/booking-history"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-4 py-2.5 text-xs font-bold text-white hover:border-white/30"
            >
              <History className="size-4" />
              Booking history
            </Link>
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Refresh tickets"
              className="grid size-10 place-items-center rounded-xl border border-white/15 bg-surface-container text-white hover:border-white/30 disabled:opacity-45"
            >
              <RefreshCcw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {query.isPending && (
          <div role="status" className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-surface-container-low p-12 text-sm">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            Loading your tickets…
          </div>
        )}

        {query.isError && (
          <div role="alert" className="mt-8 rounded-2xl border border-error/40 bg-error/10 p-6 text-center">
            <AlertTriangle className="mx-auto size-8 text-error" />
            <p className="mt-2 font-bold text-white">{getApiErrorMessage(query.error)}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white">
              Try again
            </button>
          </div>
        )}

        {query.isSuccess && (
          <div className="mt-6 space-y-4">
            {tickets.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-surface-container-low p-12 text-center">
                <Ticket className="mx-auto size-12 text-primary/70" />
                <h2 className="mt-4 font-heading text-xl font-bold text-white">No upcoming tickets</h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Tickets for screenings that have ended are kept in your booking history.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link to="/booking-history" className="rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold text-white">
                    View booking history
                  </Link>
                  <Link to="/movies" className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white">
                    Book a movie
                  </Link>
                </div>
              </div>
            ) : (
              tickets.map((item) => (
                <TicketStub key={item.booking.bookingId} item={item} now={now} onOpen={setSelectedItem} />
              ))
            )}
          </div>
        )}
      </div>

      <TicketQrModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}

export default MyTicketsPage
