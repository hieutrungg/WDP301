import ConcessionOrderSummary from '../components/ConcessionOrderSummary'
import BookingPriceSummary from '../components/BookingPriceSummary'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Armchair,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Home,
  Info,
  LoaderCircle,
  Printer,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  Ticket,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { getBookingPaymentDetails } from '../api/paymentApi'
import QrCodeImage from '../../../components/ui/QrCode'
import { getPaymentMethodOption } from '../utils/mockQrCode'
import { getBookingTickets } from '../../ticket/api/ticketApi'
import {
  formatVnDateTime,
  getTicketStatusMeta,
  isTicketAdmissible,
} from '../../ticket/utils/ticketPresentation'

// SRS 5.3 messages shown on the C15 result.
const MSG19_BOOKING_CONFIRMED = 'Booking confirmed successfully.'
const MSG14_SEAT_HOLD_EXPIRED = 'Your seat hold has expired. Please select your seats again.'

// C15 ticket stub: real TICKET-001 tickets. Payment details are loaded first; that read also
// completes any interrupted issuance on the server, so tickets are fetched only after PAID.
function IssuedTicketsStub({ ticketsQuery }) {
  if (ticketsQuery.isPending) {
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-xs text-on-surface-variant">
        <LoaderCircle className="size-6 animate-spin text-primary" />
        Loading your E-Tickets…
      </div>
    )
  }

  if (ticketsQuery.isError) {
    return (
      <div role="alert" className="my-6 w-full rounded-xl border border-error/40 bg-error/10 p-4 text-left text-xs text-on-surface-variant">
        <strong className="block text-error">Could not load E-Tickets</strong>
        {getApiErrorMessage(ticketsQuery.error)}
        <button
          type="button"
          onClick={() => ticketsQuery.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase text-white"
        >
          <RefreshCcw className="size-3.5" />
          Retry
        </button>
      </div>
    )
  }

  const tickets = ticketsQuery.data?.tickets ?? []
  if (tickets.length === 0) {
    return (
      <div className="my-6 w-full rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-left text-xs text-on-surface-variant">
        <strong className="block text-secondary">E-Tickets are being issued</strong>
        Your payment is verified. Ticket issuance has not completed yet; refresh in a moment.
        <button
          type="button"
          onClick={() => ticketsQuery.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-surface-container px-3 py-1.5 text-[11px] font-bold uppercase text-white"
        >
          <RefreshCcw className="size-3.5" />
          Refresh
        </button>
      </div>
    )
  }

  const [primary] = tickets
  return (
    <>
      <div className="my-5 flex flex-col items-center">
        {isTicketAdmissible(primary) ? (
          <QrCodeImage
            value={primary.qrCode}
            size={168}
            label="E-TICKET"
            ariaLabel={`Admission QR for seat ${primary.seat.label}`}
          />
        ) : (
          <div className="flex size-[200px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container-low p-4 text-xs text-on-surface-variant">
            {getTicketStatusMeta(primary.status).label}
          </div>
        )}
        <span className="mt-3 block text-[10px] uppercase tracking-widest text-on-surface-variant">
          Seat {primary.seat.label} • Ticket code
        </span>
        <span className="font-heading text-base font-black tracking-widest text-secondary">
          {primary.ticketCode}
        </span>
      </div>

      <ul className="w-full space-y-2 text-left" aria-label="E-Tickets in this booking">
        {tickets.map((ticket) => {
          const meta = getTicketStatusMeta(ticket.status)
          return (
            <li key={ticket.ticketId}>
              <Link
                to={`/tickets/${ticket.ticketId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#131315]/80 px-3 py-2.5 transition hover:border-primary/50"
              >
                <span>
                  <span className="block font-heading text-sm font-extrabold text-white">Seat {ticket.seat.label}</span>
                  <span className="font-mono text-[11px] text-on-surface-variant">{ticket.ticketCode}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.tone}`}>
                  {meta.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] text-on-surface-variant">Open a ticket for its fullscreen QR at the entrance.</p>
    </>
  )
}

function BookingConfirmationPage() {
  const { showtimeId, bookingId } = useParams()
  const [copied, setCopied] = useState(false)

  const detailsQuery = useQuery({
    queryKey: ['booking-payment-details', bookingId],
    enabled: Boolean(bookingId),
    retry: false,
    staleTime: 0,
    queryFn: () => getBookingPaymentDetails(bookingId),
  })

  const ticketsQuery = useQuery({
    queryKey: ['booking-tickets', bookingId],
    enabled:
      Boolean(bookingId) &&
      detailsQuery.data?.booking?.status === 'CONFIRMED' &&
      detailsQuery.data?.payment?.status === 'PAID',
    retry: false,
    staleTime: 0,
    queryFn: () => getBookingTickets(bookingId),
  })

  if (detailsQuery.isPending) {
    return (
      <main className="min-h-screen bg-background px-6 pb-20 pt-28 text-on-surface">
        <div
          role="status"
          className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface-container-low p-10 text-center"
        >
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <h1 className="mt-4 font-heading text-xl font-bold">
            Verifying Booking &amp; Payment Status…
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Checking authoritative transaction state with F-Cinema Backend.
          </p>
        </div>
      </main>
    )
  }

  if (detailsQuery.isError) {
    return (
      <main className="min-h-screen bg-background px-6 pb-20 pt-28 text-on-surface">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-error/40 bg-error/10 p-8 text-center"
        >
          <AlertTriangle className="mx-auto size-10 text-error" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-white">
            Could Not Load Booking Confirmation
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {getApiErrorMessage(detailsQuery.error)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => detailsQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
            >
              <RefreshCcw className="size-4" />
              Retry Verification
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
            >
              <Home className="size-4" />
              Return Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const data = detailsQuery.data
  const booking = data?.booking
  const payment = data?.payment
  const showtime = data?.showtime
  const seats = data?.seats?.length ? data.seats : booking?.seats || []

  const isConfirmedAndPaid =
    booking?.status === 'CONFIRMED' && payment?.status === 'PAID'
  const isLatePaymentReview = payment?.status === 'REVIEW_REQUIRED'
  const isPendingPayment = booking?.status === 'PENDING_PAYMENT'
  const effectiveShowtimeId = showtimeId || booking?.showtimeId
  const methodMeta = getPaymentMethodOption(payment?.method)
  const displayReference =
    booking?.bookingCode || booking?.payableReference || booking?.bookingId

  const handleCopyBookingRef = async () => {
    try {
      await navigator.clipboard.writeText(displayReference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="min-h-screen bg-background pb-20 pt-20 text-on-surface">
      {/* C15 Progress Stepper */}
      <nav
        aria-label="Booking progress"
        className="border-y border-white/10 bg-[#131315]/95 px-4 py-4 backdrop-blur-xl sm:px-6"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
              <CheckCircle2 className="size-4" />
              1. Select Seats
            </span>
            <span className="text-on-surface-variant">›</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
              <CheckCircle2 className="size-4" />
              2. Concessions
            </span>
            <span className="text-on-surface-variant">›</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
              <CheckCircle2 className="size-4" />
              3. Payment
            </span>
            <span className="text-on-surface-variant">›</span>
            <strong className="inline-flex items-center gap-1.5 font-bold text-secondary">
              <Ticket className="size-4" />
              4. Confirmation &amp; E-Ticket
            </strong>
          </div>

          <span className="rounded-full border border-white/10 bg-surface-container px-3 py-1 font-mono text-xs text-on-surface-variant">
            Booking Status: <strong className="text-white">{booking?.status}</strong> • Payment:{' '}
            <strong className="text-secondary">{payment?.status || 'NONE'}</strong>
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* CASE 1: Confirmed Booking & Settled Payment (C15 Screen) */}
        {isConfirmedAndPaid && (
          <>
            <section className="mb-10 flex flex-col items-center text-center">
              <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/15 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="size-10 text-emerald-400" />
              </div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Payment Successful • Verified by Backend
                </span>
              </div>

              <h1 className="font-heading text-3xl font-black tracking-tight text-white sm:text-5xl">
                Booking Confirmed!
              </h1>
              <p role="status" className="mt-2 font-semibold text-emerald-300">
                {MSG19_BOOKING_CONFIRMED}
              </p>
              <p className="mt-1 max-w-xl text-sm text-on-surface-variant sm:text-base">
                Your seats are locked and confirmed. Below is your reservation summary and your E-Tickets.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-surface-container-low px-4 py-2">
                  <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                    Booking ID:
                  </span>
                  <span className="font-heading text-sm font-extrabold tracking-wider text-secondary">
                    #{displayReference}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBookingRef}
                    title="Copy Booking ID"
                    className="text-on-surface-variant transition hover:text-white"
                  >
                    <Copy className="size-4" />
                  </button>
                  {copied && (
                    <span className="text-[11px] font-bold text-emerald-400">
                      Copied!
                    </span>
                  )}
                </div>

                {payment?.contactDetails?.email && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
                    <span>Confirmation Email:</span>
                    <strong className="text-white">
                      {payment.contactDetails.email}
                    </strong>
                  </div>
                )}
              </div>
            </section>

            {/* C15 Perforated E-Ticket Stub Card */}
            <section
              aria-label="Digital E-Ticket"
              className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#201f22] to-[#161618] shadow-2xl"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left 8 Cols: Movie, Showtime, Seats, and Payment Details */}
                <div className="p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-dashed lg:border-white/15">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-primary/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      {showtime?.format || showtime?.room?.roomType || '2D Digital'}
                    </span>
                    <span className="rounded bg-secondary/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-secondary">
                      CONFIRMED SEAT RESERVATION
                    </span>
                  </div>

                  <h2 className="mt-3 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {showtime?.movieTitle ||
                      showtime?.movie?.title ||
                      'F-Cinema Confirmed Screening'}
                  </h2>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Payable Reference:{' '}
                    <span className="font-mono text-white">
                      {booking.payableReference}
                    </span>
                  </p>

                  {/* Showtime & Seat Grid */}
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
                        <Building2 className="size-3.5 text-primary" />
                        Cinema Branch
                      </div>
                      <p className="mt-1 font-heading text-sm font-bold text-white">
                        {showtime?.cinemaName ||
                          showtime?.cinema?.branchName ||
                          'F-Cinema Vietnam'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {showtime?.roomName ||
                          showtime?.room?.roomName ||
                          'Standard Hall'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
                        <Calendar className="size-3.5 text-secondary" />
                        Screening Date &amp; Time
                      </div>
                      <p className="mt-1 font-heading text-sm font-bold text-white">
                        {formatVnDateTime(showtime?.startAt, 'Scheduled Showtime')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-400">
                        Vietnam Time (GMT+7)
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#131315]/80 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
                        <Armchair className="size-3.5 text-primary" />
                        Reserved Seats ({seats.length})
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {seats.map((seat) => (
                          <span
                            key={seat.seatId}
                            className="rounded border border-primary/40 bg-primary/20 px-2 py-0.5 font-heading text-xs font-extrabold text-white"
                          >
                            {seat.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Payment & Transaction Summary Footer */}
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Total Paid
                        </span>
                        <span className="mt-0.5 block font-heading text-base font-extrabold text-secondary">
                          {formatSeatMoney(payment.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Payment Method
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold text-white">
                          <CreditCard className="size-3.5 text-secondary" />
                          {methodMeta.label}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Settlement Ref
                        </span>
                        <span className="mt-0.5 block font-mono text-xs font-semibold text-white">
                          {payment.settlementReference ||
                            payment.settlementAttemptId}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Settled At
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-on-surface-variant">
                          {formatVnDateTime(payment.paidAt, 'Verified')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 4 Cols: issued E-Tickets (separate from the payment QR) */}
                <div className="flex flex-col items-center bg-[#131315]/60 p-6 text-center sm:p-8 lg:col-span-4">
                  <div className="w-full">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                      <QrCode className="size-3" />
                      E-TICKETS
                    </span>
                    <p className="mt-1.5 text-[11px] text-on-surface-variant">
                      One ticket per seat
                    </p>
                  </div>

                  <IssuedTicketsStub ticketsQuery={ticketsQuery} />
                </div>
              </div>
            </section>

            {/* C15 Action Buttons */}
            <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface-container-low p-5">
              <div className="flex flex-wrap items-center gap-3">
                {ticketsQuery.data?.tickets?.[0] && (
                  <Link
                    to={`/tickets/${ticketsQuery.data.tickets[0].ticketId}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    <QrCode className="size-4" />
                    Open E-Ticket
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                >
                  <Printer className="size-4 text-secondary" />
                  Print Confirmation
                </button>
                <button
                  type="button"
                  onClick={handleCopyBookingRef}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                >
                  <Copy className="size-4 text-primary" />
                  {copied ? 'Copied Reference' : 'Copy Reference'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/movies"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-6 py-3 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/25"
                >
                  <Ticket className="size-4" />
                  Book Another Movie
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
                >
                  <Home className="size-4" />
                  Return Home
                </Link>
              </div>
            </section>

            {/* C15 Important Entry Instructions */}
            <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-surface-container-low p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Clock3 className="size-4 text-primary" />
                  Arrive 15 Minutes Early
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                  Please arrive at least 15 minutes before showtime and present your booking reference #{displayReference} at the entrance.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-surface-container-low p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Info className="size-4 text-secondary" />
                  Authoritative Server Receipt
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                  Your payment ({payment.settlementReference}) has been verified and locked in VND by the F-Cinema Payment Service.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-surface-container-low p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Ticket className="size-4 text-emerald-400" />
                  Reload Safe Confirmation
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                  You can refresh or revisit this URL at any time to view your verified booking and payment state.
                </p>
              </div>
            </section>
          </>
        )}

        {/* CASE 2: Late Payment After Expiry -> REVIEW_REQUIRED */}
        {isLatePaymentReview && (
          <section
            role="alert"
            className="mx-auto max-w-3xl rounded-3xl border border-secondary/40 bg-surface-container-low p-8 shadow-2xl"
          >
            <div className="flex items-center gap-3 text-secondary">
              <ShieldAlert className="size-8 shrink-0" />
              <div>
                <span className="text-xs font-black uppercase tracking-widest">
                  Payment Resolution Pending • UC30 A1
                </span>
                <h1 className="font-heading text-2xl font-black text-white sm:text-3xl">
                  Payment Received After Your Seat Hold Expired
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
              Your mock payment notification arrived after the 10-minute seat hold and booking window expired. Per F-Cinema booking safety rules, the expired booking was <strong className="text-white">not confirmed</strong> and <strong className="text-white">no ticket was issued</strong> so seats could not be double-booked.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Your payment record is kept for reconciliation. A manager will review it and arrange a refund; you do not need to pay again for this booking.
            </p>

            <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#131315] p-5 text-xs sm:grid-cols-2">
              <div>
                <span className="text-on-surface-variant">Booking Reference:</span>
                <p className="font-mono font-bold text-white">
                  {booking?.payableReference}
                </p>
              </div>
              <div>
                <span className="text-on-surface-variant">Booking Status:</span>
                <p className="font-mono font-bold text-error">
                  {booking?.status}
                </p>
              </div>
              <div>
                <span className="text-on-surface-variant">Payment Status:</span>
                <p className="font-mono font-bold text-secondary">
                  {payment?.status} ({payment?.reconciliationReason})
                </p>
              </div>
              <div>
                <span className="text-on-surface-variant">Recorded Amount:</span>
                <p className="font-mono font-bold text-white">
                  {formatSeatMoney(payment?.amount ?? booking?.totalAmount ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {effectiveShowtimeId && (
                <Link
                  to={`/booking/${effectiveShowtimeId}/seats`}
                  className="rounded-xl bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
                >
                  Select Seats Again
                </Link>
              )}
              <Link
                to="/"
                className="rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
              >
                Return Home
              </Link>
            </div>
          </section>
        )}

        {/* CASE 3: Still Pending Payment or Expired Without Late Payment */}
        {!isConfirmedAndPaid && !isLatePaymentReview && (
          <section
            role="alert"
            className="mx-auto max-w-2xl rounded-3xl border border-white/15 bg-surface-container-low p-8 text-center"
          >
            <AlertTriangle className="mx-auto size-10 text-secondary" />
            <h1 className="mt-4 font-heading text-2xl font-black text-white">
              {isPendingPayment
                ? 'Payment Not Yet Completed'
                : 'Booking Expired or Unpaid'}
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isPendingPayment
                ? 'This booking is still awaiting verified payment settlement on the server. No E-Ticket has been issued yet.'
                : MSG14_SEAT_HOLD_EXPIRED}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isPendingPayment && effectiveShowtimeId && (
                <Link
                  to={`/booking/${effectiveShowtimeId}/checkout`}
                  className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white"
                >
                  Return to Checkout &amp; Pay
                </Link>
              )}
              {!isPendingPayment && effectiveShowtimeId && (
                <Link
                  to={`/booking/${effectiveShowtimeId}/seats`}
                  className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white"
                >
                  Select Seats Again
                </Link>
              )}
              <button
                type="button"
                onClick={() => detailsQuery.refetch()}
                className="rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
              >
                Refresh Status
              </button>
            </div>
          </section>
        )}
        <BookingPriceSummary booking={booking} />
        <ConcessionOrderSummary order={booking?.concessionOrder} paid={isConfirmedAndPaid} />
      </div>
    </main>
  )
}

export default BookingConfirmationPage
