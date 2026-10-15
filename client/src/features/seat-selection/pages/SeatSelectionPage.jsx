import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clock3, LoaderCircle, ShieldCheck, TicketCheck } from 'lucide-react'
import { Link, useParams } from 'react-router'
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

const formatVnd = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function HoldCountdown({ hold, onExpire }) {
  const [serverNowMs, setServerNowMs] = useState(() => new Date(hold.serverNow).getTime())
  const expired = useRef(false)
  const remainingMs = Math.max(0, new Date(hold.expiresAt).getTime() - serverNowMs)

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

function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const availability = useSeatAvailability(showtimeId)
  const acquire = useAcquireSeatHold(showtimeId)
  const release = useReleaseSeatHold(showtimeId)
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [activeHold, setActiveHold] = useState(null)
  const checkoutKey = useRef(null)

  const seats = useMemo(() => availability.data?.seats ?? [], [availability.data])
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
      if (Number.isSafeInteger(seat.price)) values.set(`${seat.type}:${seat.price}`, seat)
    }
    return [...values.values()]
  }, [seats])

  const handleHoldExpired = useCallback(() => {
    setActiveHold(null)
    setSelectedSeatIds([])
    checkoutKey.current = null
    availability.refetch()
    toast.error('Your seat hold expired. Please select the seats again.')
  }, [availability])

  const toggleSeat = (seatId) => {
    if (activeHold) return
    setSelectedSeatIds((current) =>
      current.includes(seatId)
        ? current.filter((selectedId) => selectedId !== seatId)
        : [...current, seatId],
    )
  }

  const holdSeats = async () => {
    if (selectedSeatIds.length === 0) {
      toast.error('Select at least one available seat.')
      return
    }
    try {
      if (!checkoutKey.current) {
        checkoutKey.current = globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}`
      }
      const result = await acquire.mutateAsync({
        showtimeId,
        seatIds: selectedSeatIds,
        checkoutKey: checkoutKey.current,
      })
      setActiveHold(result)
      toast.success('Seats held successfully. Complete checkout before the timer ends.')
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
      checkoutKey.current = null
      toast.success('Seats released.')
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  if (availability.isPending) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-background pt-20">
        <div className="text-center text-on-surface-variant">
          <LoaderCircle className="mx-auto size-9 animate-spin text-primary" />
          <p className="mt-3 text-sm">Loading seat availability…</p>
        </div>
      </main>
    )
  }

  if (availability.isError) {
    return (
      <main className="min-h-screen bg-background px-4 pb-12 pt-28">
        <div className="mx-auto max-w-4xl">
          <ErrorState message={getApiErrorMessage(availability.error)} onRetry={availability.refetch} />
        </div>
      </main>
    )
  }

  if (seats.length === 0) {
    return (
      <main className="min-h-screen bg-background px-4 pb-12 pt-28">
        <div className="mx-auto max-w-4xl">
          <EmptyState title="No seats available" description="This showtime does not have an initialized seat layout." />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-12 pt-20 text-on-surface">
      <header className="border-b border-white/5 bg-surface-container-lowest px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link to="/showtimes" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-white">
            <ArrowLeft className="size-4" /> Back to showtimes
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
            <span className="text-on-surface-variant">1 · Showtime</span>
            <span>→</span><span className="text-primary">2 · Seats</span>
            <span>→</span><span className="text-on-surface-variant">3 · Payment</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-white/5 bg-surface-container-low p-4 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Seat selection</p>
              <h1 className="mt-1 font-heading text-2xl font-bold">Choose your seats</h1>
              <p className="mt-2 text-sm text-on-surface-variant">Prices are the snapshot stored for this showtime.</p>
            </div>
            {activeHold && (
              <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Hold expires in</p>
                <p className="font-heading text-2xl font-bold text-secondary"><HoldCountdown hold={activeHold} onExpire={handleHoldExpired} /></p>
              </div>
            )}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <div className="mx-auto h-2 w-4/5 rounded-full bg-gradient-to-r from-transparent via-tertiary-fixed to-transparent shadow-[0_8px_26px_rgba(223,225,245,0.2)]" />
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-on-surface-variant">Screen</p>

            <div className="mt-9 space-y-3 overflow-x-auto pb-3">
              {rows.map(([row, rowSeats]) => (
                <div key={row} className="flex min-w-max items-center justify-center gap-2">
                  <span className="w-5 text-center text-xs font-bold text-on-surface-variant">{row}</span>
                  {rowSeats.map((seat) => (
                    <SeatButton
                      key={seat.seatId}
                      seat={seat}
                      selected={selectedSeatIds.includes(seat.seatId)}
                      onToggle={toggleSeat}
                      disabled={Boolean(activeHold)}
                    />
                  ))}
                  <span className="w-5 text-center text-xs font-bold text-on-surface-variant">{row}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-white/5 pt-5"><SeatLegend /></div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {seatTypes.map((seat) => (
              <span key={`${seat.type}:${seat.price}`} className="rounded-full bg-surface-container-high px-3 py-1.5 text-[11px] text-on-surface-variant">
                <strong className="text-on-surface">{seat.type}</strong> · {formatVnd(seat.price)}
              </span>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-white/10 bg-surface-container-low p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-container/15 text-primary"><TicketCheck className="size-5" /></span>
            <div><h2 className="font-heading font-bold">Your seats</h2><p className="text-[11px] text-on-surface-variant">Showtime {showtimeId}</p></div>
          </div>

          <div className="min-h-24 space-y-2 py-4">
            {selectedSeats.length ? selectedSeats.map((seat) => (
              <div key={seat.seatId} className="flex items-center justify-between rounded-lg bg-surface-container-high px-3 py-2 text-sm">
                <span><strong>{seat.row}{seat.number}</strong> <span className="text-[10px] text-on-surface-variant">{seat.type}</span></span>
                <span className="font-semibold text-secondary">{formatVnd(seat.price ?? 0)}</span>
              </div>
            )) : <p className="py-6 text-center text-sm text-on-surface-variant">Select available seats from the map.</p>}
          </div>

          <div className="flex items-center justify-between border-t border-white/5 py-4 font-heading text-lg font-bold">
            <span>Total</span><span className="text-secondary">{formatVnd(total)}</span>
          </div>

          {activeHold ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-secondary/10 p-3 text-xs leading-5 text-secondary">
                <Clock3 className="mt-0.5 size-4 shrink-0" /> Your seats are held until the countdown reaches zero.
              </div>
              <button type="button" disabled className="w-full cursor-not-allowed rounded-xl bg-primary-container px-4 py-3 font-bold text-white opacity-60">Continue to payment</button>
              <button type="button" onClick={releaseSeats} disabled={release.isPending} className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold hover:bg-surface-bright disabled:opacity-50">
                {release.isPending ? 'Releasing…' : 'Release seats'}
              </button>
              <p className="text-center text-[10px] text-on-surface-variant">Payment handoff remains disabled until Booking/PAY-001 integration.</p>
            </div>
          ) : (
            <button type="button" onClick={holdSeats} disabled={!selectedSeatIds.length || acquire.isPending} className="w-full rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
              {acquire.isPending ? 'Holding seats…' : `Hold ${selectedSeatIds.length || ''} seat${selectedSeatIds.length === 1 ? '' : 's'}`}
            </button>
          )}

          <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-on-surface-variant"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-secondary" />Availability is confirmed atomically by the server when you hold the seats.</p>
        </aside>
      </div>
    </main>
  )
}

export default SeatSelectionPage

