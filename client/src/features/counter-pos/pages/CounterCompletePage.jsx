import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import {
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Clock3,
  MapPin,
  Printer,
  ReceiptText,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react'

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
const formatDateTime = (value) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))

function ReceiptLine({ label, quantity = 1, amount }) {
  return <div className="grid grid-cols-[1fr_auto] gap-4 text-sm"><span>{label}{quantity > 1 ? ` × ${quantity}` : ''}</span><span className="font-semibold tabular-nums">{formatVnd(amount)}</span></div>
}

function CounterCompletePage() {
  const { state } = useLocation()
  const [printRequested, setPrintRequested] = useState(false)
  if (!state?.film || !state?.seats?.length || state?.settlement?.payment?.status !== 'PAID') return <Navigate to="/staff/pos" replace />
  const paymentId = state.settlement.payment.paymentId
  const bookingId = state.booking?.bookingId
  const concessions = state.concessionQuote?.items ?? []
  const ticketSubtotal = state.seats.reduce((sum, seat) => sum + seat.price, 0)
  const receiptNumber = `RC-${paymentId.slice(-8).toUpperCase()}`
  const paidAt = state.settlement.payment.paidAt ?? new Date().toISOString()
  const printReceipt = () => {
    setPrintRequested(true)
    window.setTimeout(() => window.print(), 0)
  }

  return <main className="mx-auto max-w-7xl space-y-5">
    <section className="no-print overflow-hidden rounded-2xl border border-secondary/20 bg-surface-container-low shadow-xl">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary/15"><CheckCircle2 className="size-8 text-secondary" /></span><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Payment confirmed</p><h1 className="mt-1 font-heading text-3xl font-bold">Counter sale completed</h1><p className="mt-2 text-sm text-tertiary">Receipt <strong className="text-on-surface">{receiptNumber}</strong> is ready to print. A browser print dialog can send it to a thermal printer or save it as PDF.</p></div></div>
        <div className="rounded-xl bg-surface-container-lowest px-5 py-4 text-right"><p className="text-xs uppercase tracking-wider text-tertiary">Paid total</p><p className="mt-1 font-heading text-3xl font-extrabold text-secondary">{formatVnd(state.total)}</p><p className="mt-1 text-xs text-tertiary">{state.method === 'CASH' ? 'Staff cash payment' : 'VNPAY QR payment'}</p></div>
      </div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
      <section className="no-print rounded-2xl bg-surface-container-low p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Admission ticket</p><h2 className="mt-1 font-heading text-xl font-bold">Ticket preview</h2></div><span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-tertiary">Issuer pending</span></div>
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(229,9,20,.28),transparent_38%),linear-gradient(145deg,#292a2e,#141519)] p-6">
          <div className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-surface-container-low" /><div className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-surface-container-low" />
          <div className="border-b border-dashed border-white/20 pb-5"><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">F-Cinema · Box Office</p><h3 className="mt-3 font-heading text-3xl font-extrabold uppercase">{state.film.title}</h3></div>
          <div className="grid gap-4 py-5 sm:grid-cols-2"><p className="flex gap-3 text-sm"><Clock3 className="mt-0.5 size-4 shrink-0 text-secondary" /><span><small className="block text-tertiary">Showtime</small><strong>{formatDateTime(state.showtime.startAt)}</strong></span></p><p className="flex gap-3 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-secondary" /><span><small className="block text-tertiary">Auditorium</small><strong>{state.showtime.room?.roomName ?? '—'}</strong></span></p></div>
          <div className="rounded-xl bg-white/8 p-5"><p className="text-xs font-bold uppercase tracking-wider text-tertiary">Seats</p><p className="mt-2 font-heading text-4xl font-extrabold text-secondary">{state.seats.map((seat) => `${seat.row}${seat.number}`).join(' · ')}</p></div>
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100"><CircleAlert className="size-5 shrink-0" /><p>Chưa thể in vé vào cửa chính thức cho tới khi Ticket issuer trả về ticket ID và QR hợp lệ. Booking đã thanh toán không bị ảnh hưởng.</p></div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-low p-3 shadow-xl sm:p-6">
        <div className="no-print mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-secondary">Sale receipt</p><h2 className="mt-1 font-heading text-xl font-bold">Print-ready receipt</h2></div><ReceiptText className="size-7 text-secondary" /></div>
        <article id="counter-sale-receipt" className="receipt-sheet mx-auto max-w-md bg-white p-7 text-neutral-950 shadow-2xl">
          <header className="border-b-2 border-neutral-900 pb-5 text-center"><p className="font-heading text-2xl font-extrabold tracking-tight">F-CINEMA</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.2em]">Sales receipt</p><p className="mt-3 text-xs text-neutral-600">{state.showtime.cinema?.branchName ?? 'F-Cinema Box Office'}</p></header>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-dashed border-neutral-400 py-4 text-xs"><dt className="text-neutral-500">Receipt</dt><dd className="text-right font-mono font-bold">{receiptNumber}</dd><dt className="text-neutral-500">Paid at</dt><dd className="text-right">{formatDateTime(paidAt)}</dd><dt className="text-neutral-500">Payment</dt><dd className="text-right font-semibold">{state.method === 'CASH' ? 'Cash · Staff counter' : 'VNPAY QR'}</dd>{bookingId && <><dt className="text-neutral-500">Booking</dt><dd className="truncate text-right font-mono">{bookingId}</dd></>}<dt className="text-neutral-500">Payment ID</dt><dd className="truncate text-right font-mono">{paymentId}</dd></dl>
          <div className="space-y-3 border-b border-dashed border-neutral-400 py-5"><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider"><Clapperboard className="size-4" /> Tickets</p>{state.seats.map((seat) => <ReceiptLine key={seat.seatId} label={`${state.film.title} · ${seat.type.replaceAll('_', ' ')} · Seat ${seat.row}${seat.number}`} amount={seat.price} />)}{concessions.length > 0 && <><p className="flex items-center gap-2 pt-3 text-xs font-extrabold uppercase tracking-wider"><UtensilsCrossed className="size-4" /> Food &amp; drink</p>{concessions.map((item) => <ReceiptLine key={`${item.itemType}:${item.itemId}`} label={item.name} quantity={item.quantity} amount={item.subtotal} />)}</>}</div>
          <div className="space-y-2 py-5 text-sm"><div className="flex justify-between text-neutral-600"><span>Ticket subtotal</span><span>{formatVnd(ticketSubtotal)}</span></div>{concessions.length > 0 && <div className="flex justify-between text-neutral-600"><span>F&amp;B subtotal</span><span>{formatVnd(concessions.reduce((sum, item) => sum + item.subtotal, 0))}</span></div>}<div className="flex justify-between border-t-2 border-neutral-900 pt-3 font-heading text-xl font-extrabold"><span>Total paid</span><span>{formatVnd(state.total)}</span></div></div>
          <footer className="border-t border-dashed border-neutral-400 pt-5 text-center text-xs text-neutral-600"><p className="font-bold text-neutral-900">Cảm ơn quý khách đã lựa chọn F-Cinema!</p><p className="mt-2">Vui lòng giữ hóa đơn để đối chiếu khi cần.</p></footer>
        </article>
      </section>
    </div>

    <section className="no-print sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface-container-low/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
      <button type="button" onClick={printReceipt} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3.5 font-extrabold text-neutral-950 hover:brightness-105"><Printer className="size-5" /> Print receipt / Save PDF</button>
      <button disabled className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-container-high px-5 py-3.5 font-bold text-tertiary opacity-70"><Ticket className="size-5" /> Ticket issuer pending</button>
      {printRequested ? <Link to="/staff/pos" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-3.5 font-bold text-white shadow-crimson"><Ticket className="size-5" /> New sale</Link> : <button type="button" disabled className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary-container/45 px-5 py-3.5 font-bold text-white"><Ticket className="size-5" /> Print receipt before new sale</button>}
    </section>
  </main>
}

export default CounterCompletePage
