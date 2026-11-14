import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock3, Copy, ExternalLink, LoaderCircle, QrCode } from 'lucide-react'
import { Link } from 'react-router'
import QrCodeImage from '../../../components/ui/QrCode'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getBookingTickets } from '../../ticket/api/ticketApi'
import {
  formatSeatType,
  formatVnDateTime,
  getTicketStatusMeta,
  isTicketAdmissible,
} from '../../ticket/utils/ticketPresentation'

// Real tickets of a paid booking (GET /api/tickets/bookings/:bookingId): one per seat, with the
// scannable QR only while the ticket is still valid for entry.
function BookingTicketsPanel({ bookingId }) {
  const [selectedId, setSelectedId] = useState(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const ticketsQuery = useQuery({
    queryKey: ['booking-tickets', bookingId],
    queryFn: () => getBookingTickets(bookingId),
    staleTime: 0,
  })

  if (ticketsQuery.isPending) {
    return (
      <div
        role="status"
        className="my-auto flex items-center gap-2 py-10 text-xs text-on-surface-variant"
      >
        <LoaderCircle className="size-5 animate-spin text-primary" />
        Loading your E-Tickets…
      </div>
    )
  }

  if (ticketsQuery.isError) {
    return (
      <div role="alert" className="my-auto space-y-3 py-8">
        <AlertTriangle className="mx-auto size-8 text-error" />
        <p className="text-xs text-on-surface-variant">
          {getApiErrorMessage(ticketsQuery.error)}
        </p>
        <button
          type="button"
          onClick={() => ticketsQuery.refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  const tickets = ticketsQuery.data?.tickets ?? []
  if (tickets.length === 0) {
    return (
      <div className="my-auto space-y-3 py-8">
        <Clock3 className="mx-auto size-10 text-amber-400" />
        <h3 className="font-heading text-base font-bold text-white">
          Tickets are being issued
        </h3>
        <p className="text-xs text-on-surface-variant">
          Your payment is confirmed. Refresh in a moment to see your E-Tickets.
        </p>
        <button
          type="button"
          onClick={() => ticketsQuery.refetch()}
          className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white"
        >
          Refresh
        </button>
      </div>
    )
  }

  const ticket =
    tickets.find(({ ticketId }) => ticketId === selectedId) ?? tickets[0]
  const status = getTicketStatusMeta(ticket.status)

  const select = (next) => {
    setSelectedId(next.ticketId)
    setCopiedCode(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.ticketCode)
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      setCopiedCode(false)
    }
  }

  return (
    <>
      <div className="w-full">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-secondary">
          <QrCode className="size-3.5" />
          E-Ticket{' '}
          {tickets.length > 1
            ? `${tickets.indexOf(ticket) + 1} of ${tickets.length}`
            : ''}
        </span>
        {tickets.length > 1 && (
          <div
            className="mt-3 flex flex-wrap justify-center gap-1.5"
            role="tablist"
            aria-label="Choose a seat"
          >
            {tickets.map((item) => (
              <button
                key={item.ticketId}
                type="button"
                role="tab"
                aria-selected={item.ticketId === ticket.ticketId}
                onClick={() => select(item)}
                className={`rounded-md border px-2.5 py-1 font-heading text-xs font-black ${item.ticketId === ticket.ticketId ? 'border-primary bg-primary/25 text-white' : 'border-white/15 text-on-surface-variant hover:text-white'}`}
              >
                {item.seat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-5 flex flex-col items-center">
        {isTicketAdmissible(ticket) ? (
          <QrCodeImage
            value={ticket.qrCode}
            size={185}
            label="E-TICKET"
            ariaLabel={`Admission QR for seat ${ticket.seat.label}`}
          />
        ) : (
          <div className="flex size-[200px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container-low p-4 text-xs text-on-surface-variant">
            {ticket.status === 'USED' && ticket.checkedInAt
              ? `Checked in at ${formatVnDateTime(ticket.checkedInAt)}`
              : status.label}
          </div>
        )}

        <span
          className={`mt-3 rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${status.tone}`}
        >
          {status.label}
        </span>
        <p className="mt-2 text-[11px] text-on-surface-variant">
          Seat {ticket.seat.label} · {formatSeatType(ticket.seat.type)}
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-surface-container px-3.5 py-2">
          <span className="font-mono text-xs font-black tracking-wider text-secondary">
            {ticket.ticketCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy ticket code"
            className="text-on-surface-variant hover:text-white"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
        {copiedCode && (
          <span className="mt-1 text-[11px] font-bold text-emerald-400">
            Ticket code copied!
          </span>
        )}
      </div>

      <Link
        to={`/tickets/${ticket.ticketId}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/25"
      >
        Open fullscreen E-Ticket
        <ExternalLink className="size-3.5" />
      </Link>
    </>
  )
}

export default BookingTicketsPanel
