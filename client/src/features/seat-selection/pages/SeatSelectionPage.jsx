import { hasRequiredRole } from '../../auth/utils/loginDestination'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  DoorOpen,
  Info,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Star,
  TicketCheck,
  Timer,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import SeatButton from '../components/SeatButton'
import SeatLegend from '../components/SeatLegend'
import { formatSeatMoney, hasValidSeatPrice, sumSeatPrices } from '../utils/seatPricing'
import { useAuth } from '../../auth/hooks/useAuth'
import { newCheckout, readCheckout, writeCheckout } from '../../booking/utils/checkoutSession'
import { useSeatAvailability } from '../hooks/useSeatAvailability'

const formatVnd = formatSeatMoney
const SEAT_SELECTION_DURATION_MS = 10 * 60 * 1000

function SelectionCountdown({ deadline, onExpire }) {
  const [now, setNow] = useState(Date.now)
  const expired = useRef(false)
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (seconds > 0 || expired.current) return
    expired.current = true
    onExpire()
  }, [seconds, onExpire])
  return <>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</>
}

const seatTypeLabel = (type) => ({
  STANDARD: 'Standard',
  VIP: 'VIP Prime',
  DOUBLE_LUXURY: 'Sweetbox (pair)',
}[type] ?? type)

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
})

function BookingStepper() {
  const completeSteps = ['Movie', 'Cinema', 'Date', 'Showtime']

  return (
    <section className="border-b border-white/5 bg-surface-container-lowest px-4 py-4 shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 xl:flex-row">
        <nav aria-label="Booking progress" className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 text-xs">
          {completeSteps.map((step, index) => (
            <Fragment key={step}>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 font-semibold">
                <CheckCircle2 className="size-3.5 fill-secondary/20 text-secondary" />
                {index + 1}. {step}
              </span>
              <span className="text-surface-variant">›</span>
            </Fragment>
          ))}
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-container px-3 py-1.5 font-bold uppercase tracking-wider text-white shadow-crimson">
            <span className="size-2 animate-pulse rounded-full bg-white" />5. Seats · Selecting
          </span>
          <span className="text-surface-variant">›</span>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-on-surface-variant/60">6. Food & Drink (optional)</span>
          <span className="text-surface-variant/50">›</span>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-on-surface-variant/60">7. Checkout & Payment</span>
        </nav>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium">
          <Zap className="size-4 fill-secondary text-secondary" />Live Seat Availability · Real-time Updates
        </span>
      </div>
    </section>
  )
}

function SessionBar({ showtime, savedCheckout, nextStepPath, selectionDeadline, onExpire }) {
  const startAt = showtime?.startAt ? new Date(showtime.startAt) : null
  const endAt = showtime?.endAt ? new Date(showtime.endAt) : null
  const movie = showtime?.movie
  const room = showtime?.room
  const cinema = showtime?.cinema
  const duration = movie?.duration ?? (
    startAt && endAt ? Math.round((endAt.getTime() - startAt.getTime()) / 60000) : null
  )

  return (
    <section className="border-b border-white/5 bg-surface-container-low px-4 py-4 shadow-inner sm:px-6">
      <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          {movie?.posterUrl ? (
            <img className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-lg" src={movie.posterUrl} alt={`${movie.title} poster`} />
          ) : (
            <span className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-surface-container-high text-primary"><Video className="size-6" /></span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              {movie?.ageRating && <span className="rounded bg-primary-container px-2 py-0.5 text-white">{movie.ageRating}</span>}
              <span className="rounded bg-secondary/15 px-2 py-0.5 text-secondary">{room?.roomType ?? 'Cinema Hall'}</span>
              {duration && <span className="text-on-surface-variant">{duration} mins</span>}
            </div>
            <h1 className="mt-1 truncate font-heading text-xl font-extrabold tracking-tight sm:text-2xl">{movie?.title ?? 'Seat Selection'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
              {startAt && <strong className="text-on-surface">{dateFormatter.format(startAt)} · {timeFormatter.format(startAt)}{endAt ? `–${timeFormatter.format(endAt)}` : ''}</strong>}
              {room?.roomName && <span>· {room.roomName}</span>}
              {cinema?.branchName && <span className="inline-flex items-center gap-1 text-secondary"><MapPin className="size-3" />{cinema.branchName}</span>}
              <Link to="/showtimes" className="inline-flex items-center gap-1 font-semibold text-primary underline hover:text-white">Change Showtime <RotateCcw className="size-3" /></Link>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 rounded-xl bg-surface-container-high px-5 py-3 shadow-lg">
          <span className="relative grid size-4 place-items-center">
            <span className="absolute size-3.5 animate-ping rounded-full bg-primary-container" />
            <span className="relative size-3 rounded-full bg-primary-container" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{savedCheckout ? 'Your checkout' : 'Seat selection time'}</p>
            <p className="font-heading text-2xl font-extrabold text-primary-container">
              {savedCheckout ? <Link to={nextStepPath} className="text-base underline">Resume checkout</Link> : <SelectionCountdown key={selectionDeadline} deadline={selectionDeadline} onExpire={onExpire} />}
              {!savedCheckout && <span className="ml-2 text-xs font-normal text-on-surface-variant">left to select</span>}
            </p>
          </div>
          <Timer className="size-6 text-on-surface-variant" />
        </div>
      </div>
    </section>
  )
}

function CurvedScreen() {
  return (
    <div className="relative mx-auto mb-8 flex w-full max-w-3xl flex-col items-center">
      <div className="pointer-events-none absolute -top-20 h-40 w-4/5 bg-gradient-to-b from-primary-container/20 to-transparent blur-3xl" />
      <svg className="h-12 w-full text-primary-container drop-shadow-[0_0_20px_rgba(229,9,20,0.5)]" fill="none" viewBox="0 0 600 50" aria-hidden="true">
        <path d="M 20 40 Q 300 5 580 40" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M 40 45 Q 300 12 560 45" stroke="white" strokeDasharray="4 4" strokeOpacity="0.28" strokeWidth="1.5" />
      </svg>
      <span className="mt-1 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-on-surface-variant"><Video className="size-3.5 text-secondary" />Auditorium Curved Cinema Screen</span>
      <span className="mt-1 text-center font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/45">Immersive projection · Surround sound</span>
    </div>
  )
}

function SeatMatrix({ rows, selectedSeatIds, interactionDisabled, onToggle }) {
  const firstPrimeRow = rows.findIndex(([, seats]) => seats.some(({ type }) => type === 'VIP'))

  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-2xl sm:p-7">
      <CurvedScreen />
      <div className="mb-4 flex items-center justify-between px-2 font-mono text-[10px] text-on-surface-variant/60">
        <span className="inline-flex items-center gap-1 rounded bg-surface-container px-2 py-1"><DoorOpen className="size-3.5 text-error" />West exit</span>
        <span className="inline-flex items-center gap-1 rounded bg-surface-container px-2 py-1">East exit<DoorOpen className="size-3.5 text-error" /></span>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="mx-auto flex min-w-max flex-col gap-2.5">
          {rows.map(([row, rowSeats], rowIndex) => (
            <Fragment key={row}>
              {rowIndex === firstPrimeRow && (
                <div className="my-1 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-secondary"><Star className="size-3 fill-secondary" />Optimum sightline · Prime sound sweetspot<Star className="size-3 fill-secondary" /></span>
                </div>
              )}
              <div className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${selectedSeatIds.some((id) => rowSeats.some((seat) => seat.seatId === id)) ? 'bg-primary-container/10' : ''}`}>
                <span className="w-6 text-center font-mono text-xs font-bold text-on-surface-variant">{row}</span>
                <div className="flex flex-1 items-center justify-center gap-1.5">
                  {rowSeats.map((seat, index) => (
                    <Fragment key={seat.seatId}>
                      {index === Math.ceil(rowSeats.length / 2) && <span className="w-5 text-center font-mono text-[9px] text-on-surface-variant/20">|</span>}
                      <SeatButton seat={seat} selected={selectedSeatIds.includes(seat.seatId)} onToggle={onToggle} disabled={interactionDisabled || !hasValidSeatPrice(seat.price)} />
                    </Fragment>
                  ))}
                </div>
                <span className="w-6 text-center font-mono text-xs font-bold text-on-surface-variant">{row}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

function BookingSummary({ selectedSeats, total, onRemove, onHold, savedCheckout, nextStepPath, selectionExpired, onRestart }) {
  return (
    <aside className="h-fit rounded-xl bg-surface-container-low p-5 shadow-xl lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2"><TicketCheck className="size-5 text-primary-container" /><h2 className="font-heading text-xl font-extrabold">Booking Summary</h2></div>
        <span className="rounded bg-primary-container/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Step 5 of 7</span>
      </div>

      <div className="py-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Selected seats ({selectedSeats.length})</p>
        <div className="space-y-2">
          {selectedSeats.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-on-surface-variant">Select your seats from the auditorium.</p>}
          {selectedSeats.map((seat) => (
            <div key={seat.seatId} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container p-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded bg-primary-container font-mono text-xs font-bold text-white shadow-crimson">{seat.row}{String(seat.number).padStart(2, '0')}</span>
                <div className="min-w-0"><p className="truncate text-sm font-bold">Seat {seat.row}{seat.number} · {seatTypeLabel(seat.type)}</p><p className="text-[10px] text-secondary">{hasValidSeatPrice(seat.price) ? (seat.type === 'DOUBLE_LUXURY' ? 'Server-confirmed price for the pair' : 'Server-confirmed showtime price') : 'Showtime price unavailable'}</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-2"><strong className="text-xs">{formatVnd(seat.price)}</strong><button type="button" disabled={Boolean(savedCheckout)} onClick={() => onRemove(seat.seatId)} title="Deselect seat" className="rounded p-1 text-on-surface-variant hover:text-error disabled:cursor-not-allowed disabled:opacity-30"><X className="size-4" /></button></div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-y border-white/5 py-4 text-xs text-on-surface-variant">
        <div className="flex justify-between"><span>{selectedSeats.length} ticket{selectedSeats.length === 1 ? '' : 's'}</span><strong className="text-on-surface">{formatVnd(total)}</strong></div>
        <div className="flex justify-between"><span className="inline-flex items-center gap-1">Hall surcharge <Info className="size-3" /></span><span>Included in seat price</span></div>
        <div className="flex items-end justify-between pt-2"><strong className="font-heading text-lg text-on-surface">Total amount</strong><strong className="font-heading text-2xl text-primary-container">{formatVnd(total)}</strong></div>
      </div>

      <div className="mt-4 space-y-3">
        {savedCheckout ? (
          <Link to={nextStepPath} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3.5 font-bold text-white">Resume checkout<ArrowRight className="size-4" /></Link>
        ) : selectionExpired ? (
          <button type="button" onClick={onRestart} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3.5 font-bold text-white"><RotateCcw className="size-4" />Select seats again</button>
        ) : (
          <button type="button" onClick={onHold} disabled={!selectedSeats.length || total === null} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3.5 font-bold text-white shadow-crimson disabled:cursor-not-allowed disabled:opacity-40">Lock seats &amp; continue<ArrowRight className="size-4" /></button>
        )}
      </div>

      <div className="mt-4 space-y-2 text-[10px] leading-4 text-on-surface-variant/75">
        <p className="flex gap-2"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-error" />You have 10 minutes to select seats. Seats are reserved only when you continue to checkout; the server sets the reservation expiry.</p>
        <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-secondary" />Age-rating admission rules shown for this movie still apply at the cinema.</p>
        <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Refund and cancellation eligibility is confirmed only by the approved policy workflow.</p>
      </div>
    </aside>
  )
}

function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { account } = useAuth()
  const savedCheckout = readCheckout(sessionStorage, account.id, showtimeId)
  const nextStepPath = `/booking/${showtimeId}/${hasRequiredRole(account, "CUSTOMER") && !savedCheckout?.bookingRequested ? "concessions" : "checkout"}`
  const availability = useSeatAvailability(showtimeId)
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [selectionDeadline, setSelectionDeadline] = useState(() => Date.now() + SEAT_SELECTION_DURATION_MS)
  const [selectionExpired, setSelectionExpired] = useState(false)

  const seats = useMemo(() => availability.data?.seats ?? [], [availability.data])
  const showtime = availability.data?.showtime ?? location.state?.showtime
  const seatById = useMemo(() => new Map(seats.map((seat) => [seat.seatId, seat])), [seats])
  const rows = useMemo(() => {
    const groups = new Map()
    for (const seat of seats) {
      if (!groups.has(seat.row)) groups.set(seat.row, [])
      groups.get(seat.row).push(seat)
    }
    return [...groups.entries()].map(([row, rowSeats]) => [
      row,
      [...rowSeats].sort((left, right) => Number(left.number) - Number(right.number)),
    ])
  }, [seats])
  const selectedSeats = selectedSeatIds.map((seatId) => seatById.get(seatId)).filter(Boolean)
  const total = sumSeatPrices(selectedSeats)
  const pricingUnavailable = seats.some((seat) => seat.availability === 'AVAILABLE' && !hasValidSeatPrice(seat.price))
  const seatTypes = useMemo(() => {
    const values = new Map()
    for (const seat of seats) {
      if (Number.isSafeInteger(seat.price)) {
        values.set(`${seat.type}:${seat.price}`, { ...seat, formattedPrice: formatVnd(seat.price) })
      }
    }
    return [...values.values()]
  }, [seats])

  const refetchAvailability = availability.refetch
  const handleSelectionExpired = useCallback(() => {
    setSelectionExpired(true)
    setSelectedSeatIds([])
    refetchAvailability()
    toast.error('Your seat selection time expired. Select seats again to continue.')
  }, [refetchAvailability])

  const restartSelection = () => {
    setSelectionDeadline(Date.now() + SEAT_SELECTION_DURATION_MS)
    setSelectionExpired(false)
    setSelectedSeatIds([])
    refetchAvailability()
  }

  const toggleSeat = (seatId) => {
    if (savedCheckout || selectionExpired) return
    if (!selectedSeatIds.includes(seatId) && !hasValidSeatPrice(seatById.get(seatId)?.price)) {
      return toast.error('Ticket price is not configured for this seat.')
    }
    setSelectedSeatIds((current) => current.includes(seatId)
      ? current.filter((selectedId) => selectedId !== seatId)
      : [...current, seatId])
  }

  const holdSeats = async () => {
    if (selectionExpired) return toast.error('Seat selection time expired. Start again to continue.')
    if (selectedSeatIds.length === 0) return toast.error('Select at least one available seat.')
    if (total === null) return toast.error('Ticket prices are not configured for all selected seats.')
    try {
      if (readCheckout(sessionStorage, account.id, showtimeId)) {
        navigate(nextStepPath)
        return
      }
      const attempt = newCheckout({ ownerId: account.id, showtimeId, seats: selectedSeats })
      writeCheckout(sessionStorage, attempt)
      navigate(nextStepPath)

    } catch {
      toast.error('Unable to save checkout in this tab. Allow browser storage and try again.')
    }
  }

  if (availability.isPending) {
    return <main className="grid min-h-screen place-items-center bg-background pt-20"><div className="text-center text-on-surface-variant"><LoaderCircle className="mx-auto size-9 animate-spin text-primary" /><p className="mt-3 text-sm">Loading live seat matrix…</p></div></main>
  }

  if (availability.isError) {
    return <main className="min-h-screen bg-background px-4 pb-12 pt-28"><div className="mx-auto max-w-4xl"><ErrorState message={getApiErrorMessage(availability.error)} onRetry={availability.refetch} /></div></main>
  }

  if (seats.length === 0) {
    return <main className="min-h-screen bg-background px-4 pb-12 pt-28"><div className="mx-auto max-w-4xl"><EmptyState title="No seats available" description="This showtime does not have an initialized seat layout." /></div></main>
  }

  return (
    <main className="min-h-screen bg-background pt-20 text-on-surface">
      <BookingStepper />
      <SessionBar showtime={showtime} savedCheckout={savedCheckout} nextStepPath={nextStepPath} selectionDeadline={selectionDeadline} onExpire={handleSelectionExpired} />

      <div className="mx-auto grid max-w-[1400px] gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-surface-container-lowest px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <Link to="/showtimes" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-white"><ArrowLeft className="size-4" />Back to Showtime Selection (Step 4)</Link>
            <div className="flex min-w-0 items-center gap-3 text-xs"><span className="rounded bg-primary-container px-2 py-1 font-bold text-white">{selectedSeats.length} SEAT{selectedSeats.length === 1 ? '' : 'S'}</span><strong className="max-w-56 truncate">{selectedSeats.map((seat) => `${seat.row}${seat.number}`).join(', ') || 'No seats selected'}</strong><span className="text-on-surface-variant/30">|</span><strong className="font-heading text-base">{formatVnd(total)}</strong></div>
            <button type="button" onClick={savedCheckout ? () => navigate(nextStepPath) : holdSeats} disabled={!savedCheckout && (selectionExpired || !selectedSeats.length || total === null)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-xs font-bold text-white shadow-crimson disabled:cursor-not-allowed disabled:opacity-45">{savedCheckout ? 'Resume checkout' : selectionExpired ? 'Selection time expired' : 'Confirm selected seats'}<ArrowRight className="size-4" /></button>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4"><SeatLegend seatTypes={seatTypes} selectedCount={selectedSeats.length} /></div>
          {selectionExpired && !savedCheckout && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-error/40 bg-error-container/20 p-4 text-sm text-error sm:flex-row sm:items-center sm:justify-between"><span><strong>Seat selection time expired.</strong> Your current selection was cleared. Start again to refresh availability.</span><button type="button" onClick={restartSelection} className="rounded-lg bg-primary-container px-4 py-2 font-bold text-white">Select again</button></div>}
          {pricingUnavailable && <div role="status" className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">Ticket prices are not configured for this showtime. Unpriced seats cannot be reserved. Please choose another showtime or refresh after pricing is configured.</div>}
          <SeatMatrix rows={rows} selectedSeatIds={selectedSeatIds} interactionDisabled={Boolean(savedCheckout) || selectionExpired} onToggle={toggleSeat} />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-on-surface-variant/70">
            <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-secondary" />Hall capacity: {seats.length} seats · Layout version {availability.data.roomLayoutVersion}</span>
            <span>Availability generated {new Date(availability.data.generatedAt).toLocaleTimeString('en-GB')}</span>
          </div>
        </section>

        <BookingSummary selectedSeats={selectedSeats} total={total} savedCheckout={savedCheckout} nextStepPath={nextStepPath} selectionExpired={selectionExpired} onRestart={restartSelection} onRemove={toggleSeat} onHold={holdSeats} />
      </div>

    </main>
  )
}

export default SeatSelectionPage
