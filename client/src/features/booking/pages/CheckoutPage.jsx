import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock3, CreditCard, LoaderCircle, ShieldCheck, Ticket } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import { acquireSeatHold, releaseSeatHold } from '../../seat-selection/api/seatHoldApi'
import { useSeatAvailability } from '../../seat-selection/hooks/useSeatAvailability'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { createPendingBooking } from '../api/bookingApi'
import { restoreCheckout, submitBooking } from '../utils/checkoutFlow'
import { clearCheckout, readCheckout, remainingHoldMs } from '../utils/checkoutSession'

const messageFor = (error) => error?.isAxiosError || !error?.message
  ? getApiErrorMessage(error) : error.message
const buttonClass = 'rounded-lg bg-primary-container px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45'
const terminalHoldCodes = new Set(['BOOKING_HOLD_EXPIRED', 'BOOKING_HOLD_NOT_AVAILABLE'])

function CheckoutPage() {
  const { showtimeId } = useParams()
  const { account } = useAuth()
  const navigate = useNavigate()
  const [attempt] = useState(() => readCheckout(sessionStorage, account.id, showtimeId))
  const [now, setNow] = useState(Date.now)
  const [booking, setBooking] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [requested, setRequested] = useState(Boolean(attempt?.bookingRequested))
  const availability = useSeatAvailability(showtimeId)
  const checkout = useQuery({
    queryKey: ['checkout', account.id, showtimeId, attempt?.checkoutKey],
    enabled: Boolean(attempt), retry: false, staleTime: 0, refetchOnWindowFocus: false,
    queryFn: () => restoreCheckout({
      attempt: readCheckout(sessionStorage, account.id, showtimeId) ?? attempt,
      acquire: acquireSeatHold, createBooking: createPendingBooking,
    }),
  })
  const hold = checkout.data?.hold
  const currentBooking = booking ?? checkout.data?.booking
  const remaining = hold ? remainingHoldMs(hold, checkout.data.receivedAt, now) : 0
  const confirmed = currentBooking?.status === 'CONFIRMED'
  const terminalError = terminalHoldCodes.has((actionError ?? checkout.error)?.response?.data?.code)
  const acquisitionRejected = !hold && !attempt?.bookingRequested &&
    [400, 404, 409, 422].includes(checkout.error?.response?.status)
  const expired = !confirmed && (terminalError || currentBooking?.status === 'EXPIRED' ||
    (hold && (remaining <= 0 || hold.status !== 'ACTIVE')))
  const showtime = availability.data?.showtime

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const confirmCheckout = async () => {
    if (busyRef.current || !hold || expired || confirmed || currentBooking) return
    busyRef.current = true
    setBusy(true)
    setActionError(null)
    try {
      setRequested(true)
      const result = await submitBooking({ attempt, hold, storage: sessionStorage, createBooking: createPendingBooking })
      setBooking(result)
    } catch (error) { setActionError(error) }
    finally { busyRef.current = false; setBusy(false) }
  }

  const returnToSeats = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setActionError(null)
    try {
      // Once Booking creation was attempted, do not release seats behind a pending/unknown Booking.
      if (hold && !requested && !attempt.bookingRequested && !expired) await releaseSeatHold(hold.holdId)
      clearCheckout(sessionStorage, account.id, showtimeId)
      navigate(`/booking/${showtimeId}/seats`, { replace: true })
    } catch (error) { setActionError(error) }
    finally { busyRef.current = false; setBusy(false) }
  }

  if (!attempt) return (
    <main className="min-h-screen bg-background px-6 pb-16 pt-32 text-on-surface">
      <div className="mx-auto max-w-xl rounded-xl bg-surface-container-low p-8 text-center">
        <Ticket className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="font-heading text-2xl font-bold">Select seats to begin checkout</h1>
        <p className="my-4 text-on-surface-variant">There is no saved checkout for this showtime in this tab.</p>
        <Link className={buttonClass} to={`/booking/${showtimeId}/seats`}>Select seats</Link>
      </div>
    </main>
  )

  const error = actionError ?? checkout.error
  const seconds = Math.max(0, Math.ceil(remaining / 1000))
  return (
    <main className="min-h-screen bg-background pb-16 pt-24 text-on-surface">
      <nav aria-label="Booking progress" className="border-y border-white/5 bg-surface-container-lowest px-6 py-4 text-center text-sm">
        Movie <span className="px-2 text-on-surface-variant">›</span> Showtime <span className="px-2 text-on-surface-variant">›</span> Seats <span className="px-2 text-on-surface-variant">›</span> <strong className="text-primary">Checkout</strong> <span className="px-2 text-on-surface-variant">›</span> Payment
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">Review your reservation</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold">Checkout &amp; Payment</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Your seats are reserved temporarily. A ticket is issued after confirmed payment.</p>
        {checkout.isFetching && <p role="status" className="mt-6 flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" />Checking your seat reservation…</p>}
        {error && <div role="alert" className="mt-6 rounded-xl border border-error/30 bg-error/10 p-4">
          <p>{messageFor(error)}</p>
          {!expired && <button className="mt-3 underline" onClick={() => { setActionError(null); checkout.refetch() }} disabled={busy || checkout.isFetching}>Check checkout again</button>}
        </div>}
        {expired && <div role="alert" className="mt-6 rounded-xl border border-secondary/30 bg-secondary/10 p-5"><h2 className="font-bold">Reservation expired or unavailable</h2><p className="mt-2 text-sm">These seats are no longer reserved for this checkout. Please select seats again.</p></div>}
        {hold && <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
          <section className="space-y-5">
            <div className="rounded-xl bg-surface-container-low p-6">
              <h2 className="font-heading text-xl font-bold">{showtime?.movie?.title ?? 'Your movie session'}</h2>
              {availability.isPending && <p role="status" className="mt-2 text-sm text-on-surface-variant">Loading session details…</p>}
              {availability.isError && <p className="mt-2 text-sm text-on-surface-variant">Session details could not be loaded. <button className="underline" onClick={() => availability.refetch()}>Retry details</button></p>}
              <p className="mt-2 text-on-surface-variant">{[showtime?.cinema?.branchName, showtime?.room?.roomName].filter(Boolean).join(' · ')}</p>
              {showtime?.startAt && <p className="mt-1 text-sm text-on-surface-variant">{new Date(showtime.startAt).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} (Vietnam time)</p>}
              <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reserved seats</h3>
              <ul className="space-y-2">{hold.priceQuote.lines.map((line) => {
                const seat = attempt.labels?.find(({ seatId }) => seatId === line.seatId)
                return <li key={line.seatId} className="flex justify-between gap-4 rounded-lg bg-surface-container p-3"><span>{seat ? `${seat.row}${seat.number}` : line.seatId}{seat?.type === 'DOUBLE_LUXURY' ? ' · Sweetbox (pair)' : ''}</span><strong>{formatSeatMoney(line.unitPrice)}</strong></li>
              })}</ul>
            </div>
            <div className="rounded-xl bg-surface-container-low p-6">
              <h2 className="font-heading text-lg font-bold">Booking status</h2>
              <p role="status" className="mt-3 font-semibold text-secondary">{expired ? 'Reservation expired or unavailable' : currentBooking ? ({ PENDING_PAYMENT: 'Awaiting payment', CONFIRMED: 'Booking confirmed', EXPIRED: 'Booking expired' }[currentBooking.status]) : 'Seats held · Review before continuing'}</p>
              {currentBooking && <><p className="mt-3 break-all text-sm text-on-surface-variant">Booking ID: {currentBooking.bookingId}</p><p className="mt-1 break-all text-sm text-on-surface-variant">Payment reference: {currentBooking.payableReference}</p></>}
              <p className="mt-3 text-sm text-on-surface-variant">{confirmed ? 'Payment and ticket details will be available when the payment result screen is connected.' : 'Creating a booking does not confirm payment or issue a ticket.'}</p>
            </div>
          </section>
          <aside className="h-fit rounded-xl bg-surface-container-low p-6 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><CreditCard className="size-5 text-primary" />Booking summary</h2>
            {!confirmed && <div className="my-5 flex items-center justify-between rounded-lg bg-surface-container p-3"><span className="flex items-center gap-2 text-sm"><Clock3 className="size-4" />Time remaining</span><strong role="timer" className="font-mono text-xl text-primary">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong></div>}
            <div className="my-5 flex justify-between border-y border-white/10 py-5"><span>Total · VND</span><strong className="text-xl text-primary">{formatSeatMoney(currentBooking?.amount ?? hold.priceQuote.totalAmount)}</strong></div>
            {!currentBooking && <button onClick={confirmCheckout} disabled={busy || expired || checkout.isFetching || checkout.isError} className={`${buttonClass} w-full`}>{busy ? 'Creating booking…' : requested ? 'Retry booking' : 'Confirm checkout'}</button>}
            {currentBooking?.status === 'PENDING_PAYMENT' && !expired && <><button disabled className={`${buttonClass} w-full`}>Payment unavailable</button><p className="mt-3 text-sm text-on-surface-variant">Payment is not available yet. Your reservation will expire at the time shown above.</p></>}
            <p className="mt-5 flex gap-2 text-xs leading-5 text-on-surface-variant"><ShieldCheck className="size-4 shrink-0" />Seat prices and totals are confirmed by the server.</p>
            {(!requested && !attempt.bookingRequested && !currentBooking || expired) && <button onClick={returnToSeats} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 text-sm underline"><ArrowLeft className="size-4" />{expired ? 'Select seats again' : 'Release seats & go back'}</button>}
          </aside>
        </div>}
        {!hold && (terminalError || acquisitionRejected) && <button onClick={returnToSeats} disabled={busy} className={`${buttonClass} mt-5`}>Select seats again</button>}
      </div>
    </main>
  )
}

function CheckoutRoute() {
  const { account } = useAuth()
  const { showtimeId } = useParams()
  return <CheckoutPage key={`${account.id}:${showtimeId}`} />
}

export default CheckoutRoute
