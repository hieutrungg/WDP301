import { Link, Navigate, useLocation } from 'react-router'
import { CheckCircle2, Printer, Ticket } from 'lucide-react'

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'

function CounterCompletePage() {
  const { state } = useLocation()
  if (!state?.film || !state?.seats?.length) return <Navigate to="/staff/pos" replace />
  return <main className="mx-auto max-w-2xl rounded-xl bg-surface-container-low p-8 text-center shadow-xl"><CheckCircle2 className="mx-auto size-16 text-secondary" /><p className="mt-5 text-xs font-bold uppercase tracking-wider text-secondary">POS preview</p><h1 className="mt-1 font-heading text-3xl font-bold">Payment ready for settlement</h1><p className="mx-auto mt-3 max-w-lg text-sm text-tertiary">This is the Staff success-screen design. The server must verify payment, confirm the booking, then issue tickets before printing is enabled.</p><div className="mt-7 rounded-xl bg-surface-container-lowest p-5 text-left"><div className="flex justify-between"><strong>{state.film.title}</strong><span>{formatVnd(state.total)}</span></div><p className="mt-2 text-sm text-tertiary">{state.showtime} · Hall 01 · Seats {state.seats.join(', ')}</p><p className="mt-2 text-sm text-tertiary">Method: {state.method}</p></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><button disabled className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-bold text-tertiary disabled:cursor-not-allowed"><Printer className="size-5" /> Print after confirmation</button><Link to="/staff/pos" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson"><Ticket className="size-5" /> New sale</Link></div></main>
}

export default CounterCompletePage
