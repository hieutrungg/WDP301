import { Armchair, Building2, Calendar, Clock3, CreditCard, ExternalLink, RefreshCcw, ShieldAlert, X } from 'lucide-react'
import { Link } from 'react-router'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { formatVnDateTime } from '../../ticket/utils/ticketPresentation'
import {
  getBookingAmount,
  getBookingRef,
  getCinemaName,
  getMovieTitle,
  getRoomName,
  hasShowtimeEnded,
  isPaidBooking,
} from '../utils/customerBookings'
import { getPaymentMethodOption } from '../utils/mockQrCode'
import BookingPriceSummary from './BookingPriceSummary'
import BookingStatusBadge from './BookingStatusBadge'
import BookingTicketsPanel from './BookingTicketsPanel'
import ConcessionOrderSummary from './ConcessionOrderSummary'

function SidePanel({ icon: Icon, tone, title, children }) {
  return (
    <div className="my-auto space-y-3 py-6">
      <Icon className={`mx-auto size-12 ${tone}`} />
      <h3 className="font-heading text-lg font-bold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-on-surface-variant">{children}</p>
    </div>
  )
}

// Booking History detail: the order (seats, F&B, payment, amount) plus its E-Tickets.
function BookingDetailModal({ item, now, onClose }) {
  if (!item) return null

  const { booking, payment, showtime } = item
  const seats = item.seats?.length ? item.seats : booking?.seats || []
  const paid = isPaidBooking(item)
  const isPending = booking?.status === 'PENDING_PAYMENT'
  const methodMeta = payment?.method ? getPaymentMethodOption(payment.method) : null
  const ended = hasShowtimeEnded(item, now)

  let sidePanel
  if (paid) {
    sidePanel = <BookingTicketsPanel bookingId={booking.bookingId} />
  } else if (booking?.status === 'REFUNDED') {
    sidePanel = (
      <SidePanel icon={RefreshCcw} tone="text-sky-300" title="Booking refunded">
        The refund for this booking is complete, so its E-Tickets are no longer valid for entry.
      </SidePanel>
    )
  } else if (payment?.status === 'REVIEW_REQUIRED') {
    sidePanel = (
      <SidePanel icon={ShieldAlert} tone="text-secondary" title="Late payment under review">
        The payment arrived after the seat hold expired ({payment?.reconciliationReason}). No E-Ticket is
        issued for an expired booking.
      </SidePanel>
    )
  } else {
    sidePanel = (
      <SidePanel icon={Clock3} tone="text-amber-400" title={isPending ? 'Payment not completed' : 'Booking expired'}>
        {isPending
          ? 'The E-Ticket QR code is issued only after the server confirms a successful payment.'
          : 'The seat hold ended before the payment was completed.'}
      </SidePanel>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-[#19191c] p-6 text-on-surface shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BookingStatusBadge item={item} />
              {paid && ended && (
                <span className="rounded-full border border-white/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Showtime ended
                </span>
              )}
            </div>
            <h2 id="booking-detail-title" className="mt-2.5 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">
              {getMovieTitle(showtime)}
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Booking code <strong className="font-mono text-secondary">#{getBookingRef(booking)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking details"
            className="rounded-xl border border-white/10 bg-surface-container p-2 text-on-surface-variant transition hover:border-white/30 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <Building2 className="size-3.5 text-primary" />
                  Cinema &amp; hall
                </div>
                <p className="mt-1.5 font-heading text-base font-bold text-white">{getCinemaName(showtime)}</p>
                <p className="mt-0.5 text-xs font-semibold text-secondary">{getRoomName(showtime)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <Calendar className="size-3.5 text-secondary" />
                  Screening
                </div>
                <p className="mt-1.5 font-heading text-base font-bold text-white">
                  {formatVnDateTime(showtime?.startAt, 'Scheduled screening')}
                </p>
                <p className="mt-0.5 text-xs text-emerald-400">Vietnam time (GMT+7)</p>
              </div>
            </div>

            <BookingPriceSummary booking={booking} />
            <ConcessionOrderSummary order={booking?.concessionOrder} paid={paid} />

            <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <Armchair className="size-4 text-primary" />
                  Seats ({seats.length})
                </span>
                <span className="font-mono text-xs font-bold text-secondary">{seats.map((s) => s.label).join(', ')}</span>
              </div>
              <div className="divide-y divide-white/10 rounded-xl border border-white/5 bg-surface-container-low">
                {seats.map((seat) => (
                  <div key={seat.seatId} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md border border-primary/40 bg-primary/20 px-2.5 py-1 font-heading text-xs font-black text-white">
                        {seat.label}
                      </span>
                      <span className="text-on-surface-variant">{seat.type || 'STANDARD'}</span>
                    </div>
                    <strong className="font-mono text-sm text-white">{formatSeatMoney(seat.unitPrice)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <CreditCard className="size-4 text-secondary" />
                Payment
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Method</span>
                  <strong className="text-white">{methodMeta ? methodMeta.label : 'No method selected'}</strong>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Settlement reference</span>
                  <span className="font-mono text-white">
                    {payment?.settlementReference || payment?.settlementAttemptId || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Booked / paid at</span>
                  <span className="text-white">{formatVnDateTime(payment?.paidAt || booking?.bookingTime, '—')}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                  <span className="font-bold uppercase tracking-wider text-on-surface-variant">Total (VND)</span>
                  <strong className="font-heading text-2xl font-black text-secondary">
                    {formatSeatMoney(getBookingAmount(item))}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between rounded-2xl border border-white/10 bg-[#131315] p-6 text-center lg:col-span-5">
            {sidePanel}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-surface-container px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
          >
            Close
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {isPending && booking?.showtimeId && (
              <Link
                to={`/booking/${booking.showtimeId}/checkout`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
              >
                Continue payment
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            {booking?.bookingId && booking?.showtimeId && (
              <Link
                to={`/booking/${booking.showtimeId}/confirmation/${booking.bookingId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
              >
                Booking confirmation
                <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingDetailModal
