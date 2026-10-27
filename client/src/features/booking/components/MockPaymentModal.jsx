import { useEffect, useRef } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Landmark,
  LoaderCircle,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  X,
} from 'lucide-react'
import QrCodeImage from '../../../components/ui/QrCode'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import {
  generateDeterministicQrMatrix,
  getPaymentMethodOption,
  isBankTransferAttempt,
} from '../utils/mockQrCode'

// How often an open bank-transfer modal asks the server to check payOS.
const PROVIDER_POLL_MS = 4000

const BANK_NAMES = Object.freeze({
  970422: 'MB Bank',
  970436: 'Vietcombank',
  970415: 'VietinBank',
  970418: 'BIDV',
  970407: 'Techcombank',
  970416: 'ACB',
  970432: 'VPBank',
  970423: 'TPBank',
})

// SRS 5.3 messages for the UC30 payment states.
const MSG14_SEAT_HOLD_EXPIRED = 'Your seat hold has expired. Please select your seats again.'
const MSG18_PAYMENT_FAILED = 'Payment failed. Please try again.'

export function MockQrSvg({
  payload,
  size = 210,
  badgeLabel = 'MOCK',
  ariaLabel = 'Mock payment QR code',
}) {
  const matrix = generateDeterministicQrMatrix(payload, 25)
  const moduleCount = matrix.length

  return (
    <div className="relative inline-flex items-center justify-center rounded-2xl bg-white p-4 shadow-xl ring-4 ring-primary/20">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${moduleCount} ${moduleCount}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        <rect width={moduleCount} height={moduleCount} fill="#FFFFFF" />
        {matrix.map((row, rowIndex) =>
          row.map((filled, colIndex) =>
            filled ? (
              <rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex}
                y={rowIndex}
                width="1"
                height="1"
                fill="#131315"
              />
            ) : null,
          ),
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-md border-2 border-white bg-[#131315] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-secondary shadow-md">
          {badgeLabel}
        </span>
      </div>
    </div>
  )
}

function MockPaymentModal({
  open,
  booking,
  payment,
  activeAttempt,
  remainingSeconds = 0,
  busy = false,
  errorMessage = null,
  onConfirmPaid,
  onSimulateFailure,
  onCancelAttempt,
  onRetryNewAttempt,
  onVerifyProvider,
  verifying = false,
}) {
  const isBankTransfer = isBankTransferAttempt(activeAttempt)
  const isBookingExpired =
    booking?.status === 'EXPIRED' || payment?.status === 'REVIEW_REQUIRED'
  const shouldPoll =
    Boolean(open && payment) &&
    isBankTransfer &&
    activeAttempt?.status === 'PENDING' &&
    !isBookingExpired

  // Keep the latest callback without restarting the interval on every parent re-render.
  const verifyRef = useRef(onVerifyProvider)
  useEffect(() => {
    verifyRef.current = onVerifyProvider
  })
  useEffect(() => {
    if (!shouldPoll) return undefined
    const timer = window.setInterval(
      () => verifyRef.current?.({ silent: true }),
      PROVIDER_POLL_MS,
    )
    return () => window.clearInterval(timer)
  }, [shouldPoll, activeAttempt?.attemptId])

  if (!open || !payment || !activeAttempt) return null

  const methodOption = getPaymentMethodOption(activeAttempt.method)
  const isAttemptFailed = activeAttempt.status === 'FAILED'
  const bank = activeAttempt.instruction?.bankAccount
  const checkoutUrl = activeAttempt.instruction?.checkoutUrl
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const seconds = String(remainingSeconds % 60).padStart(2, '0')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#1b1b1d] p-6 text-on-surface shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            {isBankTransfer ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                <Landmark className="size-3.5" />
                Real bank transfer • payOS
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-secondary">
                <QrCode className="size-3.5" />
                {activeAttempt.instruction?.disclaimer ||
                  'DEMO PAYMENT — NOT A REAL TRANSACTION'}
              </div>
            )}
            <h2
              id="mock-payment-modal-title"
              className="mt-3 font-heading text-2xl font-black tracking-tight text-white"
            >
              {isBankTransfer ? 'F-Cinema Bank Transfer' : 'F-Cinema Mock QR Checkout'}
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              {methodOption.gatewayTitle} • Attempt #{activeAttempt.attemptNumber}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Hold Countdown
              </span>
              <span className="flex items-center gap-1.5 font-mono text-lg font-black text-primary">
                <Clock3 className="size-4" />
                {minutes}:{seconds}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelAttempt}
              disabled={busy}
              aria-label="Close mock payment modal"
              className="rounded-lg border border-white/10 bg-surface-container p-2 text-on-surface-variant transition hover:border-white/30 hover:text-white disabled:opacity-45"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>{errorMessage}</div>
          </div>
        )}

        {isBookingExpired && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-secondary/40 bg-secondary/10 p-4"
          >
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-secondary" />
            <div>
              <p className="text-sm font-bold text-white">
                {payment?.status === 'REVIEW_REQUIRED'
                  ? 'Payment Resolution Pending'
                  : MSG14_SEAT_HOLD_EXPIRED}
              </p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {payment?.status === 'REVIEW_REQUIRED'
                  ? 'Your payment was received after the seat hold expired. No ticket was issued; the payment is kept for reconciliation and refund.'
                  : 'No payment can be taken for this checkout.'}
              </p>
            </div>
          </div>
        )}

        {isAttemptFailed && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-error/40 bg-error/10 p-4"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-error" />
              <div>
                <p className="text-sm font-bold text-white">{MSG18_PAYMENT_FAILED}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Reason: {activeAttempt.failureReason || 'MOCK_PAYMENT_DECLINED'}. Your live checkout still holds seats and food. Retry before the original deadline.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetryNewAttempt}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-45"
            >
              <RefreshCcw className="size-3.5" />
              Retry payment
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#131315] p-5 text-center">
            {isBankTransfer ? (
              <QrCodeImage
                value={activeAttempt.qrPayload}
                size={200}
                label="VietQR"
                ariaLabel={`VietQR bank transfer for ${formatSeatMoney(activeAttempt.amount)}`}
              />
            ) : (
              <MockQrSvg
                payload={activeAttempt.qrPayload}
                badgeLabel={methodOption.badge}
                ariaLabel={`Mock QR for ${methodOption.label} attempt ${activeAttempt.attemptId}`}
              />
            )}
            <span className="mt-4 rounded-full bg-white/5 px-3 py-1 font-mono text-[10px] text-on-surface-variant">
              {activeAttempt.gatewayTransactionRef}
            </span>
            {isBankTransfer ? (
              <>
                <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                  Scan with your banking app. This page confirms automatically when payOS receives the transfer.
                </p>
                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-secondary underline"
                  >
                    Open payOS payment page
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                Use the mock action{' '}
                <strong className="text-white">&ldquo;Simulate successful payment&rdquo;</strong> below to request payment verification.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-[#131315] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                  Payment method
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-black ${methodOption.badgeBg} ${methodOption.badgeText}`}
                  >
                    {methodOption.badge}
                  </span>
                  {methodOption.label}
                </span>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                {isBankTransfer && bank && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Bank</span>
                      <span className="font-bold text-white">
                        {BANK_NAMES[bank.bin] || `BIN ${bank.bin}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Account number</span>
                      <span className="font-mono font-bold text-white">{bank.accountNumber}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Account name</span>
                      <span className="text-right font-bold text-white">{bank.accountName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">Transfer content</span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono font-bold text-emerald-300">
                        {activeAttempt.instruction?.transferContent}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant">Booking Reference</span>
                  <span className="font-mono font-bold text-white">
                    {payment.payableReference}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant">Attempt ID</span>
                  <span className="font-mono text-white">
                    {activeAttempt.attemptId}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant">Attempt status</span>
                  <span className="rounded bg-secondary/15 px-2 py-0.5 font-mono text-[11px] font-bold text-secondary">
                    {activeAttempt.status}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Payment amount
                  </span>
                  <span className="font-heading text-2xl font-black text-secondary">
                    {formatSeatMoney(activeAttempt.amount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                {isBankTransfer ? 'How to pay' : 'Mock payment instructions'}
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-on-surface-variant">
                {methodOption.instructions.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            {shouldPoll && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
              >
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  Waiting for your transfer… checking with payOS
                </span>
                <button
                  type="button"
                  onClick={() => onVerifyProvider?.({ silent: false })}
                  disabled={busy || verifying}
                  className="rounded-lg border border-emerald-400/40 px-3 py-1.5 font-bold text-white disabled:opacity-45"
                >
                  {verifying ? 'Checking…' : "I've transferred — check now"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancelAttempt}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-surface-container px-4 py-3 text-xs font-bold text-on-surface transition hover:border-white/30 hover:text-white disabled:opacity-45"
            >
              Cancel attempt & return
            </button>
            {activeAttempt.status === 'PENDING' && (
              <button
                type="button"
                onClick={onSimulateFailure}
                disabled={busy}
                className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-xs font-bold text-error transition hover:bg-error/20 disabled:opacity-45"
              >
                Simulate failure
              </button>
            )}
          </div>

          {activeAttempt.status === 'PENDING' && !isBookingExpired && (
            <button
              type="button"
              onClick={onConfirmPaid}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-6 py-3.5 font-heading text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Verifying payment…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Simulate successful payment
                </>
              )}
            </button>
          )}
        </div>
        {isBankTransfer && activeAttempt.status === 'PENDING' && (
          <p className="mt-3 text-right text-[10px] text-on-surface-variant">
            Simulation buttons are for demos and debugging only: they settle locally without moving money and close the payOS link.
          </p>
        )}
      </div>
    </div>
  )
}

export default MockPaymentModal
