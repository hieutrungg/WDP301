import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Armchair,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  Ticket,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import QrCodeImage from '../../../components/ui/QrCode'
import { getBookingTickets, getTicket } from '../api/ticketApi'
import {
  formatScreeningDateTime,
  formatSeatType,
  getSiblingTickets,
  getTicketStatusMeta,
  isTicketAdmissible,
} from '../utils/ticketPresentation'

// C17 Fullscreen E-Ticket. Ownership is enforced by GET /api/tickets/:ticketId (BR-36).
function ETicketPage() {
  const { ticketId } = useParams()

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    enabled: Boolean(ticketId),
    retry: false,
    queryFn: () => getTicket(ticketId),
  })
  const bookingId = ticketQuery.data?.bookingId
  const siblingsQuery = useQuery({
    queryKey: ['booking-tickets', bookingId],
    enabled: Boolean(bookingId),
    retry: false,
    queryFn: () => getBookingTickets(bookingId),
  })

  if (ticketQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-on-surface">
        <div role="status" className="flex flex-col items-center text-center">
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-on-surface-variant">Loading your E-Ticket…</p>
        </div>
      </main>
    )
  }

  if (ticketQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-on-surface">
        <div role="alert" className="max-w-md rounded-2xl border border-error/40 bg-error/10 p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-error" />
          <h1 className="mt-4 font-heading text-xl font-bold text-white">E-Ticket Unavailable</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{getApiErrorMessage(ticketQuery.error)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => ticketQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
            >
              <RefreshCcw className="size-4" />
              Retry
            </button>
            <Link
              to="/my-tickets"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
            >
              My Tickets
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const ticket = ticketQuery.data
  const { screening, seat } = ticket
  const statusMeta = getTicketStatusMeta(ticket.status)
  const admissible = isTicketAdmissible(ticket)
  const schedule = formatScreeningDateTime(screening.startAt)
  const siblings = getSiblingTickets(siblingsQuery.data?.tickets, ticket.ticketId)

  return (
    <main className="min-h-screen bg-[#0d0e12] px-4 pb-16 pt-6 text-on-surface sm:px-6">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <Link
          to={`/bookings/${ticket.bookingId}/confirmation`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Booking details
        </Link>
        {siblings.total > 1 && (
          <span className="font-mono text-xs text-on-surface-variant">
            Ticket {siblings.index + 1} / {siblings.total}
          </span>
        )}
      </div>

      <article
        aria-label="Fullscreen E-Ticket"
        className="mx-auto mt-5 max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#201f22] to-[#161618] shadow-2xl"
      >
        <header className="border-b border-dashed border-white/15 p-6 text-center">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${statusMeta.tone}`}>
            <Ticket className="size-3.5" />
            {statusMeta.label}
          </span>
          <h1 className="mt-3 font-heading text-2xl font-black tracking-tight text-white">
            {screening.movieTitle || 'F-Cinema Screening'}
          </h1>
          {screening.ageRating && (
            <span className="mt-2 inline-block rounded bg-primary/20 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-primary">
              {screening.ageRating}
            </span>
          )}
        </header>

        <section className="flex flex-col items-center px-6 py-7">
          {admissible ? (
            <QrCodeImage
              value={ticket.qrCode}
              size={232}
              label="E-TICKET"
              ariaLabel={`Admission QR for ticket ${ticket.ticketCode}`}
            />
          ) : (
            <div className="flex size-[264px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface-container-low p-6 text-center">
              <AlertTriangle className="size-9 text-on-surface-variant" />
              <p className="mt-3 text-sm font-semibold text-white">QR not available</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {ticket.status === 'USED'
                  ? 'This ticket has already been checked in.'
                  : 'This ticket is no longer valid for entry.'}
              </p>
            </div>
          )}
          <span className="mt-4 text-[10px] uppercase tracking-widest text-on-surface-variant">Ticket code</span>
          <span className="font-heading text-xl font-black tracking-[0.2em] text-secondary">{ticket.ticketCode}</span>
        </section>

        <dl className="grid grid-cols-2 gap-3 border-t border-dashed border-white/15 p-6 text-left">
          <div className="col-span-2 rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
              <Building2 className="size-3.5 text-primary" />
              Cinema &amp; room
            </dt>
            <dd className="mt-1 font-heading text-sm font-bold text-white">{screening.cinemaName || 'F-Cinema'}</dd>
            <dd className="text-xs text-on-surface-variant">
              {[screening.roomName, screening.roomType].filter(Boolean).join(' • ') || 'Room details unavailable'}
            </dd>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
              <Calendar className="size-3.5 text-secondary" />
              Date
            </dt>
            <dd className="mt-1 text-sm font-bold text-white">{schedule?.date || 'To be announced'}</dd>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
              <Clock3 className="size-3.5 text-secondary" />
              Showtime
            </dt>
            <dd className="mt-1 text-sm font-bold text-white">{schedule?.time || '--:--'}</dd>
            <dd className="text-[11px] text-on-surface-variant">Vietnam time (GMT+7)</dd>
          </div>
          <div className="col-span-2 rounded-xl border border-primary/30 bg-primary/10 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
              <Armchair className="size-3.5 text-primary" />
              Seat
            </dt>
            <dd className="mt-1 font-heading text-2xl font-black text-white">{seat.label}</dd>
            <dd className="text-xs text-on-surface-variant">{formatSeatType(seat.type)} seat</dd>
          </div>
        </dl>

        <footer className="border-t border-white/10 bg-[#131315]/60 px-6 py-4 text-[11px] leading-relaxed text-on-surface-variant">
          Show this QR code or ticket code at the entrance. Each seat has its own ticket and can be checked in once.
        </footer>
      </article>

      {siblings.total > 1 && (
        <nav aria-label="Other tickets in this booking" className="mx-auto mt-5 flex max-w-md items-center justify-between gap-3">
          {siblings.previous ? (
            <Link
              to={`/tickets/${siblings.previous.ticketId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-surface-container px-4 py-2.5 text-xs font-bold text-white"
            >
              <ChevronLeft className="size-4" />
              Seat {siblings.previous.seat.label}
            </Link>
          ) : <span />}
          {siblings.next ? (
            <Link
              to={`/tickets/${siblings.next.ticketId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-surface-container px-4 py-2.5 text-xs font-bold text-white"
            >
              Seat {siblings.next.seat.label}
              <ChevronRight className="size-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </main>
  )
}

export default ETicketPage
