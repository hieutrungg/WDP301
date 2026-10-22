import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  Lock,
  Popcorn,
  QrCode,
  ShieldCheck,
  Ticket,
  UserCheck,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import { acquireSeatHold, releaseSeatHold } from '../../seat-selection/api/seatHoldApi'
import { useSeatAvailability } from '../../seat-selection/hooks/useSeatAvailability'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { createPendingBooking } from '../api/bookingApi'
import {
  cancelPaymentAttempt,
  initiatePayment,
  simulatePaymentAttempt,
} from '../api/paymentApi'
import MockPaymentModal, { MockQrSvg } from '../components/MockPaymentModal'
import { restoreCheckout, submitBooking } from '../utils/checkoutFlow'
import {
  clearCheckout,
  readCheckout,
  remainingHoldMs,
} from '../utils/checkoutSession'
import {
  buildPaymentAttemptKey,
  getPaymentMethodOption,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHODS,
} from '../utils/mockQrCode'

const messageFor = (error) =>
  error?.isAxiosError || !error?.message
    ? getApiErrorMessage(error)
    : error.message

const buttonClass =
  'rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-5 py-3.5 font-heading font-bold text-white shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45'

const terminalHoldCodes = new Set([
  'BOOKING_HOLD_EXPIRED',
  'BOOKING_HOLD_NOT_AVAILABLE',
  'BOOKING_ALREADY_EXPIRED',
])

function CheckoutPage() {
  const { showtimeId } = useParams()
  const { account } = useAuth()
  const navigate = useNavigate()
  const [attempt] = useState(() =>
    readCheckout(sessionStorage, account.id, showtimeId),
  )
  const [now, setNow] = useState(Date.now)
  const [booking, setBooking] = useState(null)
  const [paymentState, setPaymentState] = useState(null)
  const [activeAttempt, setActiveAttempt] = useState(null)
  const [attemptSeq, setAttemptSeq] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState(
    PAYMENT_METHODS.MOMO_WALLET,
  )
  const [contactDetails, setContactDetails] = useState(() => ({
    fullName:
      account?.profile?.fullName ||
      account?.fullName ||
      account?.username ||
      'Customer',
    phone: account?.phone || '0901234567',
    email: account?.email || 'customer@fcinema.vn',
    citizenId: '',
    instantZalo: true,
  }))
  const [actionError, setActionError] = useState(null)
  const [modalError, setModalError] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [requested, setRequested] = useState(Boolean(attempt?.bookingRequested))

  const availability = useSeatAvailability(showtimeId)
  const checkout = useQuery({
    queryKey: ['checkout', account.id, showtimeId, attempt?.checkoutKey],
    enabled: Boolean(attempt),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: () =>
      restoreCheckout({
        attempt:
          readCheckout(sessionStorage, account.id, showtimeId) ?? attempt,
        acquire: acquireSeatHold,
        createBooking: createPendingBooking,
      }),
  })

  const hold = checkout.data?.hold
  const currentBooking = booking ?? checkout.data?.booking
  const remaining = hold
    ? remainingHoldMs(hold, checkout.data.receivedAt, now)
    : 0
  const confirmed =
    currentBooking?.status === 'CONFIRMED' && paymentState?.status === 'PAID'
  const isReviewRequired = paymentState?.status === 'REVIEW_REQUIRED'
  const terminalError = terminalHoldCodes.has(
    (actionError ?? checkout.error)?.response?.data?.code,
  )
  const acquisitionRejected =
    !hold &&
    !attempt?.bookingRequested &&
    [400, 404, 409, 422].includes(checkout.error?.response?.status)
  const expired =
    !confirmed &&
    (terminalError ||
      currentBooking?.status === 'EXPIRED' ||
      isReviewRequired ||
      (hold && (remaining <= 0 || hold.status !== 'ACTIVE')))
  const showtime = availability.data?.showtime

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const startPaymentAttemptForBooking = async (
    targetBooking,
    methodToUse,
    sequenceToUse,
  ) => {
    const idempotencyKey = buildPaymentAttemptKey({
      bookingId: targetBooking.bookingId,
      method: methodToUse,
      attemptSequence: sequenceToUse,
    })

    const initiated = await initiatePayment({
      bookingId: targetBooking.bookingId,
      method: methodToUse,
      idempotencyKey,
      amount: targetBooking.amount ?? targetBooking.totalAmount,
      contactDetails: {
        fullName: contactDetails.fullName,
        email: contactDetails.email,
        phone: contactDetails.phone,
      },
    })

    setPaymentState(initiated.payment)
    setActiveAttempt(initiated.activeAttempt)
    setModalError(null)
    setModalOpen(true)
    return initiated
  }

  const handleCompletePayment = async () => {
    if (busyRef.current || !hold || expired || confirmed) return
    busyRef.current = true
    setBusy(true)
    setActionError(null)
    setModalError(null)

    try {
      let targetBooking = currentBooking
      if (!targetBooking) {
        setRequested(true)
        targetBooking = await submitBooking({
          attempt,
          hold,
          storage: sessionStorage,
          createBooking: createPendingBooking,
        })
        setBooking(targetBooking)
      }

      if (
        activeAttempt &&
        activeAttempt.status === 'PENDING' &&
        activeAttempt.method === selectedMethod
      ) {
        setModalOpen(true)
        return
      }

      const nextSequence = attemptSeq
      setAttemptSeq((prev) => prev + 1)
      await startPaymentAttemptForBooking(
        targetBooking,
        selectedMethod,
        nextSequence,
      )
    } catch (error) {
      setActionError(error)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleConfirmMockPaid = async () => {
    if (busyRef.current || !paymentState || !activeAttempt) return
    busyRef.current = true
    setBusy(true)
    setModalError(null)

    try {
      const result = await simulatePaymentAttempt({
        paymentId: paymentState.paymentId,
        attemptId: activeAttempt.attemptId,
        outcome: 'SUCCESS',
        notificationKey: `ui-confirm:${activeAttempt.attemptId}`,
      })

      setPaymentState(result.payment)
      setActiveAttempt(result.activeAttempt)
      if (result.booking) {
        setBooking((prev) => ({
          ...(prev || {}),
          ...result.booking,
        }))
      }

      if (
        result.booking?.status === 'CONFIRMED' &&
        result.payment?.status === 'PAID'
      ) {
        setModalOpen(false)
        clearCheckout(sessionStorage, account.id, showtimeId)
        navigate(
          `/booking/${showtimeId}/confirmation/${result.booking.bookingId}`,
          { replace: true },
        )
        return
      }

      if (
        result.outcome === 'EXPIRED_REVIEW_REQUIRED' ||
        result.payment?.status === 'REVIEW_REQUIRED'
      ) {
        setModalOpen(false)
        clearCheckout(sessionStorage, account.id, showtimeId)
        navigate(
          `/booking/${showtimeId}/confirmation/${result.booking.bookingId}`,
          { replace: true },
        )
      }
    } catch (error) {
      setModalError(messageFor(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleSimulateFailure = async () => {
    if (busyRef.current || !paymentState || !activeAttempt) return
    busyRef.current = true
    setBusy(true)
    setModalError(null)

    try {
      const result = await simulatePaymentAttempt({
        paymentId: paymentState.paymentId,
        attemptId: activeAttempt.attemptId,
        outcome: 'FAILED',
        notificationKey: `ui-fail:${activeAttempt.attemptId}`,
        failureReason: 'USER_SIMULATED_DECLINE',
      })
      setPaymentState(result.payment)
      setActiveAttempt(result.activeAttempt)
    } catch (error) {
      setModalError(messageFor(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleRetryNewAttempt = async () => {
    if (busyRef.current || !currentBooking) return
    busyRef.current = true
    setBusy(true)
    setModalError(null)

    try {
      const nextSequence = attemptSeq
      setAttemptSeq((prev) => prev + 1)
      await startPaymentAttemptForBooking(
        currentBooking,
        selectedMethod,
        nextSequence,
      )
    } catch (error) {
      setModalError(messageFor(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleCancelModalAttempt = async () => {
    if (busyRef.current) return
    if (!paymentState || !activeAttempt || activeAttempt.status !== 'PENDING') {
      setModalOpen(false)
      return
    }

    busyRef.current = true
    setBusy(true)
    setModalError(null)
    try {
      const result = await cancelPaymentAttempt({
        paymentId: paymentState.paymentId,
        attemptId: activeAttempt.attemptId,
        reason: 'USER_CHANGED_PAYMENT_METHOD',
      })
      setPaymentState(result.payment)
      setActiveAttempt(result.activeAttempt)
      setModalOpen(false)
    } catch {
      setModalOpen(false)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const returnToSeats = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setActionError(null)
    try {
      if (hold && !requested && !attempt.bookingRequested && !expired) {
        await releaseSeatHold(hold.holdId)
      }
      clearCheckout(sessionStorage, account.id, showtimeId)
      navigate(`/booking/${showtimeId}/seats`, { replace: true })
    } catch (error) {
      setActionError(error)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (!attempt) {
    return (
      <main className="min-h-screen bg-background px-6 pb-16 pt-32 text-on-surface">
        <div className="mx-auto max-w-xl rounded-xl bg-surface-container-low p-8 text-center">
          <Ticket className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="font-heading text-2xl font-bold">
            Select seats to begin checkout
          </h1>
          <p className="my-4 text-on-surface-variant">
            There is no saved checkout for this showtime in this tab.
          </p>
          <Link className={buttonClass} to={`/booking/${showtimeId}/seats`}>
            Select seats
          </Link>
        </div>
      </main>
    )
  }

  const error = actionError ?? checkout.error
  const seconds = Math.max(0, Math.ceil(remaining / 1000))
  const selectedMethodMeta = getPaymentMethodOption(selectedMethod)
  const totalAmount = currentBooking?.amount ?? hold?.priceQuote?.totalAmount ?? 0

  return (
    <main className="min-h-screen bg-background pb-20 pt-20 text-on-surface">
      {/* C14 Progress Stepper Header */}
      <nav
        aria-label="Booking progress"
        className="border-y border-white/10 bg-[#131315]/95 px-4 py-4 backdrop-blur-xl sm:px-6"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs sm:gap-4 sm:text-sm">
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
            <strong className="inline-flex items-center gap-1.5 font-bold text-white">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
                3
              </span>
              Checkout &amp; Payment
            </strong>
            <span className="text-on-surface-variant">›</span>
            <span className="text-on-surface-variant">4. Confirmation</span>
          </div>

          {!confirmed && hold && (
            <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5">
              <Clock3 className="size-4 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Seats Held:
              </span>
              <strong
                role="timer"
                className="font-mono text-base font-black text-primary"
              >
                {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                {String(seconds % 60).padStart(2, '0')}
              </strong>
            </div>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">
            Step 03 • Secure Checkout &amp; Mock Gateway
          </p>
          <h1 className="mt-1 font-heading text-3xl font-black tracking-tight">
            Checkout &amp; Payment
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Your seats are reserved temporarily. Complete mock payment verification to confirm your booking and view your E-Ticket.
          </p>
        </div>

        {checkout.isFetching && (
          <p role="status" className="my-6 flex items-center gap-2 text-sm">
            <LoaderCircle className="size-5 animate-spin text-primary" />
            Checking your seat reservation…
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="my-6 rounded-xl border border-error/30 bg-error/10 p-4"
          >
            <p className="font-medium text-error">{messageFor(error)}</p>
            {!expired && (
              <button
                type="button"
                className="mt-3 text-sm underline"
                onClick={() => {
                  setActionError(null)
                  checkout.refetch()
                }}
                disabled={busy || checkout.isFetching}
              >
                Check checkout again
              </button>
            )}
          </div>
        )}

        {expired && (
          <div
            role="alert"
            className="my-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-secondary/40 bg-secondary/10 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-secondary" />
              <div>
                <h2 className="font-bold text-white">
                  {isReviewRequired
                    ? 'Late payment detected after hold expiry (REVIEW_REQUIRED)'
                    : 'Reservation expired or unavailable'}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isReviewRequired
                    ? 'Your payment notification arrived after the seat hold expired. The booking was not confirmed and is flagged for reconciliation.'
                    : 'These seats are no longer reserved for this checkout. Please select seats again.'}
                </p>
              </div>
            </div>
            {currentBooking?.bookingId && (
              <Link
                to={`/booking/${showtimeId}/confirmation/${currentBooking.bookingId}`}
                className="rounded-lg border border-secondary/40 bg-secondary/20 px-4 py-2 text-xs font-bold text-secondary hover:bg-secondary/30"
              >
                View Booking Status
              </Link>
            )}
          </div>
        )}

        {hold && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: C14 Sections 01, 02, 03 */}
            <section className="space-y-6 lg:col-span-8">
              {/* 01. Contact Details */}
              <div className="rounded-2xl border border-white/10 bg-surface-container-low p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 font-heading text-xs font-bold text-primary">
                      01
                    </span>
                    <h2 className="font-heading text-lg font-bold">
                      Contact Details
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <UserCheck className="size-3.5 text-emerald-400" />
                    Auto-filled from profile
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="checkout-full-name"
                      className="mb-1.5 block text-xs font-medium text-on-surface-variant"
                    >
                      Full Name <span className="text-primary">*</span>
                    </label>
                    <input
                      id="checkout-full-name"
                      type="text"
                      value={contactDetails.fullName}
                      onChange={(event) =>
                        setContactDetails((prev) => ({
                          ...prev,
                          fullName: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#131315] px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-phone"
                      className="mb-1.5 block text-xs font-medium text-on-surface-variant"
                    >
                      Phone Number (Vietnam) <span className="text-primary">*</span>
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={contactDetails.phone}
                      onChange={(event) =>
                        setContactDetails((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#131315] px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="mb-1.5 block text-xs font-medium text-on-surface-variant"
                    >
                      Email Address (For E-Ticket){' '}
                      <span className="text-primary">*</span>
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      value={contactDetails.email}
                      onChange={(event) =>
                        setContactDetails((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#131315] px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-cccd"
                      className="mb-1.5 block text-xs font-medium text-on-surface-variant"
                    >
                      Citizen ID / CCCD (Optional for age-restricted films)
                    </label>
                    <input
                      id="checkout-cccd"
                      type="text"
                      placeholder="12-digit CCCD number"
                      value={contactDetails.citizenId}
                      onChange={(event) =>
                        setContactDetails((prev) => ({
                          ...prev,
                          citizenId: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#131315] px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 02. Concessions & Add-ons (C14 Section 02) */}
              <div className="rounded-2xl border border-white/10 bg-surface-container-low p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 font-heading text-xs font-bold text-primary">
                      02
                    </span>
                    <div>
                      <h2 className="font-heading text-lg font-bold">
                        Concessions &amp; Add-ons
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        Online ticket reservation • Concession add-ons: 0 ₫
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#131315] px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    <Popcorn className="size-3.5 text-secondary" />
                    0 Items Selected
                  </span>
                </div>
              </div>

              {/* 03. Payment Method (All 4 C14 Payment Methods) */}
              <div className="rounded-2xl border border-white/10 bg-surface-container-low p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 font-heading text-xs font-bold text-primary">
                      03
                    </span>
                    <div>
                      <h2 className="font-heading text-lg font-bold">
                        Payment Method
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        All methods run through F-Cinema Internal Mock Payment Gateway (No external API keys required)
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-secondary">
                    Internal Mock Gateway
                  </span>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Payment methods"
                  className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => {
                    const isSelected = selectedMethod === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedMethod(option.id)}
                        className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                            : 'border-white/10 bg-[#131315] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-md ${option.badgeBg} ${option.badgeText}`}
                          >
                            {option.badge}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {option.label}
                            </div>
                            <div className="text-[11px] text-on-surface-variant">
                              {option.subtitle}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`flex size-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-white/30'
                          }`}
                        >
                          {isSelected && (
                            <span className="size-2 rounded-full bg-white" />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* C14 Selected Method Preview Panel */}
                <div className="mt-5 rounded-xl border border-white/10 bg-[#131315] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary">
                        <QrCode className="size-4" />
                        {selectedMethodMeta.gatewayTitle}
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Click <strong className="text-white">Complete Payment</strong> in the Order Summary to generate your unique Mock QR Payment Attempt and confirm with{' '}
                        <strong className="text-white">&ldquo;Tôi đã thanh toán&rdquo;</strong>.
                      </p>
                    </div>
                    {activeAttempt && (
                      <div className="flex items-center gap-3">
                        <MockQrSvg
                          payload={activeAttempt.qrPayload}
                          size={72}
                          badgeLabel={selectedMethodMeta.badge}
                          ariaLabel="Active payment attempt QR preview"
                        />
                        <div className="text-xs">
                          <div className="font-mono font-bold text-white">
                            {activeAttempt.attemptId}
                          </div>
                          <div className="text-on-surface-variant">
                            Status: {activeAttempt.status}
                          </div>
                          <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="mt-1 font-bold text-primary underline"
                          >
                            Open QR Modal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column: Sticky Order Summary (C14) */}
            <aside className="lg:col-span-4">
              <div className=" rounded-2xl border border-white/10 bg-surface-container-low p-6 lg:sticky lg:top-24">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold">
                    <CreditCard className="size-5 text-primary" />
                    Order Summary
                  </h2>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {currentBooking?.payableReference
                      ? `#${currentBooking.payableReference}`
                      : `#${hold.priceQuote.quoteId}`}
                  </span>
                </div>

                {/* Movie & Showtime Details */}
                <div className="border-b border-white/10 py-4">
                  <h3 className="font-heading text-lg font-extrabold text-white">
                    {showtime?.movie?.title ?? 'Your movie session'}
                  </h3>
                  {availability.isPending && (
                    <p
                      role="status"
                      className="mt-1 text-xs text-on-surface-variant"
                    >
                      Loading session details…
                    </p>
                  )}
                  {availability.isError && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Session details could not be loaded.{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => availability.refetch()}
                      >
                        Retry details
                      </button>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {[showtime?.cinema?.branchName, showtime?.room?.roomName]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {showtime?.startAt && (
                    <p className="mt-1 text-xs font-medium text-secondary">
                      {new Date(showtime.startAt).toLocaleString('en-GB', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}{' '}
                      (Vietnam time)
                    </p>
                  )}
                </div>

                {/* Reserved Seats Breakdown */}
                <div className="border-b border-white/10 py-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Reserved Seats ({hold.priceQuote.lines.length})
                    </span>
                    <span className="text-xs font-semibold text-secondary">
                      {expired
                        ? 'Expired'
                        : currentBooking
                          ? {
                              PENDING_PAYMENT: 'Awaiting Payment',
                              CONFIRMED: 'Confirmed',
                              EXPIRED: 'Expired',
                            }[currentBooking.status]
                          : 'Seats Held'}
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {hold.priceQuote.lines.map((line) => {
                      const seat = attempt.labels?.find(
                        ({ seatId }) => seatId === line.seatId,
                      )
                      return (
                        <li
                          key={line.seatId}
                          className="flex items-center justify-between gap-3 rounded-lg bg-[#131315] px-3 py-2"
                        >
                          <span className="font-medium text-white">
                            {seat ? `${seat.row}${seat.number}` : line.seatId}
                            {seat?.type ? ` · ${seat.type}` : ''}
                          </span>
                          <strong className="font-mono text-white">
                            {formatSeatMoney(line.unitPrice)}
                          </strong>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 border-b border-white/10 py-4 text-xs">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Tickets Subtotal</span>
                    <span className="font-mono text-white">
                      {formatSeatMoney(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Concessions &amp; Combos</span>
                    <span className="font-mono text-white">0 ₫</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Voucher / Discount</span>
                    <span className="font-mono text-emerald-400">0 ₫</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Selected Gateway</span>
                    <span className="font-semibold text-white">
                      {selectedMethodMeta.label}
                    </span>
                  </div>
                </div>

                {/* Total Payable */}
                <div className="my-5 flex items-baseline justify-between">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Total Amount · VND
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      VAT Included
                    </span>
                  </div>
                  <strong className="font-heading text-2xl font-black text-secondary">
                    {formatSeatMoney(totalAmount)}
                  </strong>
                </div>

                {currentBooking && (
                  <div className="mb-4 rounded-xl border border-white/10 bg-[#131315] p-3 text-xs">
                    <p className="break-all text-on-surface-variant">
                      Booking ID:{' '}
                      <span className="font-mono text-white">
                        {currentBooking.bookingId}
                      </span>
                    </p>
                    <p className="mt-1 break-all text-on-surface-variant">
                      Payment reference:{' '}
                      <span className="font-mono text-white">
                        {currentBooking.payableReference}
                      </span>
                    </p>
                  </div>
                )}

                {/* Primary CTA: Complete Payment */}
                <button
                  type="button"
                  onClick={handleCompletePayment}
                  disabled={
                    busy ||
                    expired ||
                    confirmed ||
                    checkout.isFetching ||
                    checkout.isError
                  }
                  className={`${buttonClass} flex w-full items-center justify-center gap-2`}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="size-4" />
                      Complete Payment
                    </>
                  )}
                </button>

                <p className="mt-4 flex gap-2 text-xs leading-5 text-on-surface-variant">
                  <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                  Seat prices and totals are confirmed by the server. Tickets are issued only after backend payment verification.
                </p>

                {((!requested &&
                  !attempt.bookingRequested &&
                  !currentBooking) ||
                  expired) && (
                  <button
                    type="button"
                    onClick={returnToSeats}
                    disabled={busy}
                    className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-on-surface-variant underline hover:text-white"
                  >
                    <ArrowLeft className="size-4" />
                    {expired ? 'Select seats again' : 'Release seats & go back'}
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {!hold && (terminalError || acquisitionRejected) && (
          <button
            type="button"
            onClick={returnToSeats}
            disabled={busy}
            className={`${buttonClass} mt-5`}
          >
            Select seats again
          </button>
        )}
      </div>

      {/* Mock QR Payment Modal */}
      <MockPaymentModal
        open={modalOpen}
        booking={currentBooking}
        payment={paymentState}
        activeAttempt={activeAttempt}
        remainingSeconds={seconds}
        busy={busy}
        errorMessage={modalError}
        onConfirmPaid={handleConfirmMockPaid}
        onSimulateFailure={handleSimulateFailure}
        onCancelAttempt={handleCancelModalAttempt}
        onRetryNewAttempt={handleRetryNewAttempt}
      />
    </main>
  )
}

function CheckoutRoute() {
  const { account } = useAuth()
  const { showtimeId } = useParams()
  return <CheckoutPage key={`${account.id}:${showtimeId}`} />
}

export default CheckoutRoute
