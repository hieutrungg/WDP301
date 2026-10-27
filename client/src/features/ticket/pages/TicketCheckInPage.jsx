import { CircleAlert, CircleCheck, Clock3, History, Info, LogIn, TicketCheck, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { checkInTicket } from '../api/ticketApi'
import {
  bookingProgressLabel,
  describeCheckInFailure,
  normalizeTicketCode,
  validateTicketCode,
} from '../utils/checkIn'
import { formatScreeningDateTime, formatSeatType, formatVnDateTime } from '../utils/ticketPresentation'

const HISTORY_LIMIT = 10

const toneStyles = {
  success: { box: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-300', icon: CircleCheck },
  warning: { box: 'border-amber-400/30 bg-amber-400/10', text: 'text-amber-200', icon: TriangleAlert },
  danger: { box: 'border-red-400/30 bg-error-container/30', text: 'text-red-300', icon: CircleAlert },
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-on-surface">{value || '—'}</p>
    </div>
  )
}

function ResultCard({ result }) {
  const style = toneStyles[result.tone]
  const Icon = style.icon

  if (result.tone !== 'success') {
    return (
      <section role="alert" className={`rounded-2xl border p-5 ${style.box}`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 size-6 shrink-0 ${style.text}`} />
          <div>
            <p className={`font-heading text-lg font-bold ${style.text}`}>{result.title}</p>
            <p className="mt-1 text-sm text-on-surface">{result.message}</p>
            <p className="mt-2 font-mono text-xs text-on-surface-variant">{result.ticketCode}</p>
          </div>
        </div>
      </section>
    )
  }

  const { ticket, bookingCheckIn } = result
  const screening = formatScreeningDateTime(ticket.screening.startAt)

  return (
    <section role="status" className={`rounded-2xl border p-5 ${style.box}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-7 shrink-0 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <p className={`font-heading text-xl font-bold ${style.text}`}>Admit — {result.message}</p>
          <p className="mt-1 font-mono text-sm text-on-surface">{ticket.ticketCode}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Movie" value={ticket.screening.movieTitle} />
        <Detail label="Seat" value={`${ticket.seat.label} · ${formatSeatType(ticket.seat.type)}`} />
        <Detail label="Cinema / Room" value={[ticket.screening.cinemaName, ticket.screening.roomName].filter(Boolean).join(' · ')} />
        <Detail label="Showtime" value={screening ? `${screening.date} ${screening.time}` : null} />
        <Detail label="Age rating" value={ticket.screening.ageRating} />
        <Detail label="Checked in at" value={formatVnDateTime(ticket.checkedInAt)} />
      </div>
      {bookingCheckIn && (
        <p className="mt-4 rounded-lg bg-surface-container-lowest/60 px-3 py-2 text-xs text-on-surface-variant">
          {bookingProgressLabel(bookingCheckIn)}
        </p>
      )}
    </section>
  )
}

// TICKET-101: the Staff member types or pastes the ticket code from the customer's E-Ticket.
function TicketCheckInPage() {
  const inputRef = useRef(null)
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  const record = (entry) => {
    setResult(entry)
    setHistory((items) => [{ ...entry, at: new Date().toISOString() }, ...items].slice(0, HISTORY_LIMIT))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const error = validateTicketCode(code)
    setFieldError(error)
    if (error) return

    const ticketCode = normalizeTicketCode(code)
    setSubmitting(true)
    try {
      const data = await checkInTicket(ticketCode)
      record({ tone: 'success', ticketCode, message: data.message, ticket: data.ticket, bookingCheckIn: data.bookingCheckIn })
      setCode('')
    } catch (failure) {
      record({ ticketCode, ...describeCheckInFailure(failure) })
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <span className="size-1.5 rounded-full bg-primary-container" />
          Counter
        </p>
        <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
          Ticket Check-in
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Type or paste the ticket code shown on the customer&apos;s E-Ticket, for example{' '}
          <span className="font-mono text-on-surface">TK-1A2B3C4D5E</span>. Each code admits one seat, once.
        </p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-white/5 bg-surface-container-low p-4 sm:p-5">
        <label htmlFor="ticket-code" className="text-sm font-semibold text-on-surface">
          Ticket code
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="ticket-code"
            ref={inputRef}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase())
              if (fieldError) setFieldError('')
            }}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'ticket-code-error' : undefined}
            placeholder="TK-XXXXXXXXXX"
            className="h-14 flex-1 rounded-lg border border-transparent bg-surface-container px-4 font-mono text-lg tracking-[0.15em] text-on-surface outline-none transition placeholder:text-on-surface-variant/40 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 aria-[invalid=true]:border-red-400/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-primary-container px-6 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn className="size-5" />
            {submitting ? 'Checking...' : 'Check in'}
          </button>
        </div>
        {fieldError && (
          <p id="ticket-code-error" className="mt-2 text-xs text-red-300">
            {fieldError}
          </p>
        )}
      </form>

      {result && <ResultCard result={result} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="checkin-history" className="rounded-2xl border border-white/5 bg-surface-container-low">
          <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
            <History className="size-4 text-on-surface-variant" />
            <h2 id="checkin-history" className="text-sm font-semibold text-on-surface">
              Recent attempts on this screen
            </h2>
          </div>
          {history.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No ticket checked yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {history.map((entry) => (
                <li key={`${entry.at}-${entry.ticketCode}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-mono text-on-surface">{entry.ticketCode}</span>
                    <span className="block truncate text-xs text-on-surface-variant">
                      {entry.tone === 'success'
                        ? `${entry.ticket.screening.movieTitle ?? 'Ticket'} · Seat ${entry.ticket.seat.label}`
                        : entry.message}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-xs font-bold ${toneStyles[entry.tone].text}`}>
                      {entry.tone === 'success' ? 'Checked in' : entry.title}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">{formatVnDateTime(entry.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-3 rounded-2xl border border-secondary/15 bg-secondary/5 p-4 text-xs text-on-surface-variant">
          <p className="flex items-center gap-2 font-heading text-sm font-bold text-on-surface">
            <Info className="size-4 text-secondary" />
            Check-in rules
          </p>
          <p className="flex gap-2">
            <Clock3 className="size-4 shrink-0" />
            Opens 30 minutes before the showtime starts and closes when the showtime ends.
          </p>
          <p className="flex gap-2">
            <TicketCheck className="size-4 shrink-0" />
            A ticket is admitted only once. Refunded or cancelled tickets are refused.
          </p>
          <p className="flex gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            Only tickets for your own branch can be checked in here.
          </p>
        </aside>
      </div>
    </div>
  )
}

export default TicketCheckInPage
