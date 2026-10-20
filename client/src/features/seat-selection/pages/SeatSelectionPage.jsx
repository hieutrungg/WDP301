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
  MapPin,
  RotateCcw,
  ShieldCheck,
  Star,
  TicketCheck,
  Timer,
  Utensils,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import { toast } from 'sonner'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import SeatButton from '../components/SeatButton'
import SeatLegend from '../components/SeatLegend'
import {
  useAcquireSeatHold,
  useReleaseSeatHold,
  useSeatAvailability,
} from '../hooks/useSeatAvailability'

const formatVnd = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount ?? 0)} ₫`
const SEAT_SELECTION_DURATION_MS = 10 * 60 * 1000
const seatTypeLabel = (type) => ({
  STANDARD: 'Standard',
  VIP: 'VIP Prime',
  DOUBLE_LUXURY: 'Sweetbox',
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

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${String(minutes).padStart(2, '0')}:${seconds}`
}

const createSelectionWindow = (serverNow) => {
  const startedAt = new Date(serverNow)
  return {
    serverNow: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + SEAT_SELECTION_DURATION_MS).toISOString(),
  }
}

function SelectionCountdown({ expiresAt, serverNow, onExpire }) {
  const expiresAtMs = new Date(expiresAt).getTime()
  const initialServerNow = new Date(serverNow).getTime()
  const [serverNowMs, setServerNowMs] = useState(initialServerNow)
  const expired = useRef(false)
  const remainingMs = Math.max(0, expiresAtMs - serverNowMs)

  useEffect(() => {
    const timer = window.setInterval(() => setServerNowMs((value) => value + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (remainingMs > 0 || expired.current) return
    expired.current = true
    onExpire()
  }, [onExpire, remainingMs])

  return <>{formatCountdown(remainingMs)}</>
}

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
          <span className="shrink-0 rounded-full px-3 py-1.5 text-on-surface-variant/60">6. F&amp;B Combos</span>
          <span className="text-surface-variant/50">›</span>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-on-surface-variant/60">7. Payment</span>
        </nav>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium">
          <Zap className="size-4 fill-secondary text-secondary" />Live Seat Availability · Real-time Updates
        </span>
      </div>
    </section>
  )
}

function SessionBar({ showtime, activeHold, selectionWindow, onExpire }) {
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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Seat selection time</p>
            <p className="font-heading text-2xl font-extrabold text-primary-container">
              <SelectionCountdown
                key={activeHold?.expiresAt ?? selectionWindow.expiresAt}
                expiresAt={activeHold?.expiresAt ?? selectionWindow.expiresAt}
                serverNow={activeHold?.serverNow ?? selectionWindow.serverNow}
                onExpire={onExpire}
              />
              <span className="ml-2 text-xs font-normal text-on-surface-variant">remaining</span>
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
                      <SeatButton seat={seat} selected={selectedSeatIds.includes(seat.seatId)} onToggle={onToggle} disabled={interactionDisabled} />
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

function BookingSummary({ selectedSeats, total, activeHold, selectionExpired, acquirePending, releasePending, onRemove, onHold, onRelease, onRestart }) {
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
                <div className="min-w-0"><p className="truncate text-sm font-bold">Seat {seat.row}{seat.number} · {seatTypeLabel(seat.type)}</p><p className="text-[10px] text-secondary">Server-confirmed showtime price</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-2"><strong className="text-xs">{formatVnd(seat.price)}</strong><button type="button" disabled={Boolean(activeHold) || selectionExpired} onClick={() => onRemove(seat.seatId)} title="Deselect seat" className="rounded p-1 text-on-surface-variant hover:text-error disabled:cursor-not-allowed disabled:opacity-30"><X className="size-4" /></button></div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-y border-white/5 py-4 text-xs text-on-surface-variant">
        <div className="flex justify-between"><span>{selectedSeats.length} ticket{selectedSeats.length === 1 ? '' : 's'}</span><strong className="text-on-surface">{formatVnd(total)}</strong></div>
        <div className="flex justify-between"><span className="inline-flex items-center gap-1">Hall surcharge <Info className="size-3" /></span><span>Included in seat price</span></div>
        <div className="flex justify-between"><span>Promotions, fees &amp; taxes</span><span>Calculated at checkout</span></div>
        <div className="flex items-end justify-between pt-2"><strong className="font-heading text-lg text-on-surface">Total amount</strong><strong className="font-heading text-2xl text-primary-container">{formatVnd(total)}</strong></div>
      </div>

      <div className="mt-4 space-y-3">
        {selectionExpired ? (
          <button type="button" onClick={onRestart} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3.5 font-bold text-white shadow-crimson transition hover:brightness-110">
            <RotateCcw className="size-4" />Select seats again
          </button>
        ) : !activeHold ? (
          <button type="button" onClick={onHold} disabled={!selectedSeats.length || acquirePending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3.5 font-bold text-white shadow-[0_0_20px_rgba(229,9,20,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {acquirePending ? <LoaderCircle className="size-4 animate-spin" /> : <TicketCheck className="size-4" />}{acquirePending ? 'Confirming selection…' : 'Confirm selected seats'}
          </button>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" disabled className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-secondary/15 px-3 py-3 font-bold text-secondary opacity-55"><Utensils className="size-4" /><span>Choose F&amp;B</span></button>
              <button type="button" disabled className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-primary-container px-3 py-3 font-bold text-white opacity-55"><span>Skip to payment</span><ArrowRight className="size-4" /></button>
            </div>
            <button type="button" onClick={onRelease} disabled={releasePending} className="w-full rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold hover:bg-surface-bright disabled:opacity-50">{releasePending ? 'Releasing…' : 'Release all seats'}</button>
            <p className="text-center text-[10px] text-on-surface-variant">F&amp;B and Customer Payment routes will become available when their approved contracts are implemented.</p>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2 text-[10px] leading-4 text-on-surface-variant/75">
        <p className="flex gap-2"><Timer className="mt-0.5 size-3.5 shrink-0 text-error" />You have 10 minutes to select seats and continue. The timer runs even when no seat is selected.</p>
        <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-secondary" />Age-rating admission rules shown for this movie still apply at the cinema.</p>
        <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Refund and cancellation eligibility is confirmed only by the approved policy workflow.</p>
      </div>
    </aside>
  )
}

function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const location = useLocation()
  const availability = useSeatAvailability(showtimeId)
  const acquire = useAcquireSeatHold(showtimeId)
  const release = useReleaseSeatHold(showtimeId)
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [activeHold, setActiveHold] = useState(null)
  const [selectionWindowOverride, setSelectionWindowOverride] = useState(null)
  const [selectionExpired, setSelectionExpired] = useState(false)
  const checkoutKey = useRef(null)

  const seats = useMemo(() => availability.data?.seats ?? [], [availability.data])
  const showtime = availability.data?.showtime ?? location.state?.showtime
  const selectionWindow = useMemo(() => {
    if (selectionWindowOverride) return selectionWindowOverride
    return availability.data?.generatedAt
      ? createSelectionWindow(availability.data.generatedAt)
      : null
  }, [availability.data, selectionWindowOverride])
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
  const total = selectedSeats.reduce((sum, seat) => sum + (seat.price ?? 0), 0)
  const seatTypes = useMemo(() => {
    const values = new Map()
    for (const seat of seats) {
      if (Number.isSafeInteger(seat.price)) {
        values.set(`${seat.type}:${seat.price}`, { ...seat, formattedPrice: formatVnd(seat.price) })
      }
    }
    return [...values.values()]
  }, [seats])

  const handleHoldExpired = useCallback(() => {
    setActiveHold(null)
    setSelectedSeatIds([])
    setSelectionExpired(true)
    checkoutKey.current = null
    availability.refetch()
    toast.error('Your seat selection time expired. Select seats again to continue.')
  }, [availability])

  const restartSelection = () => {
    setSelectionWindowOverride(createSelectionWindow(new Date()))
    setSelectionExpired(false)
    setSelectedSeatIds([])
    checkoutKey.current = null
    availability.refetch()
    toast.info('A new 10-minute seat selection session has started.')
  }

  const toggleSeat = (seatId) => {
    if (activeHold || selectionExpired) return
    setSelectedSeatIds((current) => current.includes(seatId)
      ? current.filter((selectedId) => selectedId !== seatId)
      : [...current, seatId])
  }

  const holdSeats = async () => {
    if (selectionExpired) return toast.error('Seat selection time expired. Start again to continue.')
    if (selectedSeatIds.length === 0) return toast.error('Select at least one available seat.')
    try {
      if (!checkoutKey.current) checkoutKey.current = globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}`
      const result = await acquire.mutateAsync({ showtimeId, seatIds: selectedSeatIds, checkoutKey: checkoutKey.current })
      setActiveHold(result)
      toast.success('Seats selected. Choose F&B or continue to payment within 10 minutes.')
    } catch (error) {
      toast.error(getApiErrorMessage(error))
      availability.refetch()
    }
  }

  const releaseSeats = async () => {
    if (!activeHold) return
    try {
      await release.mutateAsync(activeHold.holdId)
      setActiveHold(null)
      setSelectedSeatIds([])
      setSelectionWindowOverride(createSelectionWindow(new Date()))
      setSelectionExpired(false)
      checkoutKey.current = null
      toast.success('Seat selection cleared.')
    } catch (error) {
      toast.error(getApiErrorMessage(error))
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

  if (!selectionWindow) {
    return <main className="grid min-h-screen place-items-center bg-background pt-20"><div className="text-center text-on-surface-variant"><LoaderCircle className="mx-auto size-9 animate-spin text-primary" /><p className="mt-3 text-sm">Starting seat selection timer…</p></div></main>
  }

  return (
    <main className="min-h-screen bg-background pt-20 text-on-surface">
      <BookingStepper />
      <SessionBar showtime={showtime} activeHold={activeHold} selectionWindow={selectionWindow} onExpire={handleHoldExpired} />

      <div className="mx-auto grid max-w-[1400px] gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-surface-container-lowest px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <Link to="/showtimes" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-white"><ArrowLeft className="size-4" />Back to Showtime Selection (Step 4)</Link>
            <div className="flex min-w-0 items-center gap-3 text-xs">
              <span className="rounded bg-primary-container px-2 py-1 font-bold text-white">{selectedSeats.length} SEAT{selectedSeats.length === 1 ? '' : 'S'}</span>
              <strong className="max-w-56 truncate">{selectedSeats.map((seat) => `${seat.row}${seat.number}`).join(', ') || 'No seats selected'}</strong>
              <span className="text-on-surface-variant/30">|</span>
              <strong className="font-heading text-base">{formatVnd(total)}</strong>
            </div>
            <button type="button" onClick={activeHold || selectionExpired ? undefined : holdSeats} disabled={Boolean(activeHold) || selectionExpired || !selectedSeats.length || acquire.isPending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-xs font-bold text-white shadow-crimson disabled:cursor-not-allowed disabled:opacity-45">{selectionExpired ? 'Selection time expired' : activeHold ? 'Seats confirmed · Choose next step' : 'Confirm selected seats'}{activeHold ? <Utensils className="size-4" /> : <ArrowRight className="size-4" />}</button>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4"><SeatLegend seatTypes={seatTypes} selectedCount={selectedSeats.length} /></div>
          {selectionExpired && (
            <div role="alert" className="flex flex-col gap-3 rounded-xl border border-error/40 bg-error-container/20 p-4 text-sm text-error sm:flex-row sm:items-center sm:justify-between">
              <span><strong>Seat selection time expired.</strong> Your current selection was cleared. Start again to refresh availability.</span>
              <button type="button" onClick={restartSelection} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2 font-bold text-white"><RotateCcw className="size-4" />Select again</button>
            </div>
          )}
          <SeatMatrix rows={rows} selectedSeatIds={selectedSeatIds} interactionDisabled={Boolean(activeHold) || selectionExpired} onToggle={toggleSeat} />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-on-surface-variant/70">
            <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-secondary" />Hall capacity: {seats.length} seats · Layout version {availability.data.roomLayoutVersion}</span>
            <span>Availability generated {new Date(availability.data.generatedAt).toLocaleTimeString('en-GB')}</span>
          </div>
        </section>

        <BookingSummary selectedSeats={selectedSeats} total={total} activeHold={activeHold} selectionExpired={selectionExpired} acquirePending={acquire.isPending} releasePending={release.isPending} onRemove={toggleSeat} onHold={holdSeats} onRelease={releaseSeats} onRestart={restartSelection} />
      </div>

    </main>
  )
}

export default SeatSelectionPage
