import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, Banknote, CreditCard, QrCode, ReceiptText } from 'lucide-react'

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'

function CounterPaymentPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [method, setMethod] = useState('cash')
  const [tendered, setTendered] = useState('')
  const total = state?.total ?? 0
  const tenderedValue = Number(tendered.replaceAll('.', '')) || 0
  const change = tenderedValue - total
  const canConfirm = method !== 'cash' || change >= 0
  const paymentMethods = [{ id: 'cash', label: 'Cash', icon: Banknote }, { id: 'card', label: 'Card', icon: CreditCard }, { id: 'qr', label: 'QR payment', icon: QrCode }]
  const presets = useMemo(() => [total, Math.ceil(total / 50000) * 50000, 500000], [total])
  const setAmount = (amount) => setTendered(String(amount))
  if (!state?.film || !state?.seats?.length) return <Navigate to="/staff/pos" replace />
  return <div className="mx-auto max-w-5xl space-y-4"><button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-tertiary hover:text-on-surface"><ArrowLeft className="size-4" /> Back to seat selection</button><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl bg-surface-container-low p-6"><p className="text-xs font-bold uppercase tracking-wider text-primary">Counter payment</p><h1 className="mt-1 font-heading text-2xl font-bold">Order review</h1><div className="mt-6 rounded-xl bg-surface-container-lowest p-4"><h2 className="font-heading text-lg font-bold">{state.film.title}</h2><p className="mt-1 text-sm text-tertiary">Today · {state.showtime} · Hall 01</p><div className="mt-4 space-y-2">{state.seats.map((seat) => <div key={seat} className="flex justify-between text-sm"><span>VIP seat {seat}</span><span>{formatVnd(190000)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-surface-container-high pt-4 font-heading text-xl font-bold"><span>Total due</span><span>{formatVnd(state.total)}</span></div></div></section><section className="rounded-xl bg-surface-container-low p-6"><h2 className="font-heading text-lg font-bold">Payment method</h2><div className="mt-4 grid grid-cols-3 gap-2">{paymentMethods.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setMethod(id)} className={`rounded-xl p-3 text-sm font-semibold ${method === id ? 'bg-primary-container text-white' : 'bg-surface-container-high text-tertiary hover:text-on-surface'}`}><Icon className="mx-auto mb-2 size-5" />{label}</button>)}</div>{method === 'cash' ? <div className="mt-6"><label className="text-sm font-semibold">Cash received</label><input value={tendered ? new Intl.NumberFormat('vi-VN').format(tenderedValue) : ''} onChange={(event) => setTendered(event.target.value.replaceAll('.', '').replace(/\D/g, ''))} inputMode="numeric" className="mt-2 w-full rounded-xl bg-surface-container-high px-4 py-3 text-xl font-bold outline-none ring-primary focus:ring-2" placeholder="0" /><div className="mt-3 flex gap-2">{presets.map((value) => <button key={value} onClick={() => setAmount(value)} className="rounded-lg bg-surface-container-high px-3 py-2 text-xs text-tertiary hover:text-on-surface">{formatVnd(value)}</button>)}</div><div className={`mt-5 rounded-xl p-4 ${change >= 0 ? 'bg-secondary-container/20 text-secondary' : 'bg-error-container/30 text-error'}`}><p className="text-xs font-bold uppercase">{change >= 0 ? 'Change to customer' : 'Insufficient cash'}</p><p className="mt-1 font-heading text-2xl font-bold">{formatVnd(Math.abs(change))}</p></div></div> : <div className="mt-6 rounded-xl bg-surface-container-lowest p-5 text-center text-sm text-tertiary">{method === 'qr' ? 'Generate provider QR after Payment contract is available.' : 'Card terminal confirmation will be verified by Payment service.'}</div>}<button disabled={!canConfirm} onClick={() => navigate('/staff/pos/complete', { state: { ...state, method, tendered: tenderedValue } })} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-4 font-bold text-white shadow-crimson disabled:cursor-not-allowed disabled:opacity-50"><ReceiptText className="size-5" /> Confirm payment and print</button><p className="mt-3 text-center text-xs text-tertiary">Payment confirmation and ticket issuance require the server workflow.</p></section></div></div>
}

export default CounterPaymentPage
