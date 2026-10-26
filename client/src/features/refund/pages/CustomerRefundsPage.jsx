import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDollarSign, Clock3, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { listMyBookingPayments } from '../../booking/api/paymentApi'
import { formatSeatMoney } from '../../seat-selection/utils/seatPricing'
import { listMyRefunds, requestRefund } from '../api/refundApi'

const statusStyle = { REQUESTED: 'text-amber-300', PROCESSING: 'text-secondary', REFUNDED: 'text-emerald-400', REJECTED: 'text-error', FAILED: 'text-error' }

function CustomerRefundsPage() {
  const client = useQueryClient()
  const [bookingId, setBookingId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const bookings = useQuery({ queryKey: ['my-booking-payments'], queryFn: listMyBookingPayments })
  const refunds = useQuery({ queryKey: ['my-refunds'], queryFn: listMyRefunds })
  const existing = new Set((refunds.data?.items ?? []).map((item) => item.bookingId))
  const eligible = (bookings.data?.items ?? []).filter(({ booking, payment }) => booking.status === 'CONFIRMED' && payment?.status === 'PAID' && !existing.has(booking.bookingId))
  const submit = async (event) => {
    event.preventDefault(); setBusy(true)
    try { await requestRefund({ bookingId, reason }); setBookingId(''); setReason(''); await client.invalidateQueries({ queryKey: ['my-refunds'] }); toast.success('Refund request submitted for manager review.') }
    catch (error) { toast.error(getApiErrorMessage(error)) }
    finally { setBusy(false) }
  }
  if (bookings.isPending || refunds.isPending) return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-8 animate-spin text-primary" /></div>
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Customer self-service</p><h1 className="mt-2 font-heading text-3xl font-extrabold">Cancellation &amp; refund</h1><p className="mt-2 text-sm text-tertiary">Requests close 45 minutes before showtime. Checked-in tickets are not eligible.</p></header>
    <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-surface-container-low p-5"><Clock3 className="size-5 text-secondary" /><strong className="mt-3 block">45-minute cutoff</strong><p className="mt-1 text-xs text-tertiary">Evaluated by the server using showtime time.</p></div><div className="rounded-2xl bg-surface-container-low p-5"><ShieldCheck className="size-5 text-secondary" /><strong className="mt-3 block">Unused value only</strong><p className="mt-1 text-xs text-tertiary">Tickets plus F&amp;B that has not been fulfilled.</p></div><div className="rounded-2xl bg-surface-container-low p-5"><CircleDollarSign className="size-5 text-secondary" /><strong className="mt-3 block">Original payment method</strong><p className="mt-1 text-xs text-tertiary">Demo processing uses the safe mock refund provider.</p></div></section>
    <form onSubmit={submit} className="rounded-2xl bg-surface-container-low p-6"><h2 className="font-heading text-xl font-bold">New request</h2><label className="mt-5 block text-sm font-semibold">Paid booking<select required value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-2 w-full rounded-xl bg-surface-container-high px-4 py-3"><option value="">Select a booking</option>{eligible.map(({ booking, payment, showtime }) => <option key={booking.bookingId} value={booking.bookingId}>{showtime?.movieTitle ?? booking.bookingCode} · {formatSeatMoney(payment.amount)}</option>)}</select></label><label className="mt-4 block text-sm font-semibold">Reason<textarea required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 min-h-28 w-full rounded-xl bg-surface-container-high px-4 py-3" placeholder="Tell us why you cannot attend…" /></label><button disabled={busy || !bookingId} className="mt-5 rounded-xl bg-primary-container px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit refund request'}</button></form>
    <section className="rounded-2xl bg-surface-container-low p-6"><h2 className="font-heading text-xl font-bold">Request history</h2><div className="mt-4 space-y-3">{!(refunds.data?.items?.length) && <p className="text-sm text-tertiary">No refund requests yet.</p>}{refunds.data?.items?.map((item) => <article key={item.refundId} className="rounded-xl bg-surface-container-lowest p-4"><div className="flex flex-wrap justify-between gap-3"><div><strong className={statusStyle[item.status]}>{item.status}</strong><p className="mt-1 text-sm text-tertiary">{item.reason}</p></div><strong>{formatSeatMoney(item.refundAmount)}</strong></div>{item.rejectionReason && <p className="mt-3 text-xs text-error">Rejected: {item.rejectionReason}</p>}{item.failureReason && <p className="mt-3 text-xs text-error">Processing failed: {item.failureReason}</p>}</article>)}</div></section>
  </main>
}
export default CustomerRefundsPage
