import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Clock3, Search, Ticket } from 'lucide-react'

const films = [
  { id: 'dune', title: 'Dune Part Two', genre: 'Sci-Fi', duration: '166 min', shows: ['13:30', '16:45', '19:30'], age: 'T16' },
  { id: 'kungfu', title: 'Kung Fu Panda 4', genre: 'Animation', duration: '94 min', shows: ['12:15', '15:00', '18:15'], age: 'P' },
  { id: 'godzilla', title: 'Godzilla x Kong', genre: 'Action', duration: '115 min', shows: ['14:00', '17:10', '20:20'], age: 'T13' },
]

const seatLabels = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']
const unavailableSeats = new Set(['A1', 'B4', 'C5'])

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'

function CounterPosPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filmId, setFilmId] = useState('dune')
  const [showtime, setShowtime] = useState('19:30')
  const [selectedSeats, setSelectedSeats] = useState([])
  const [notice, setNotice] = useState('')
  const film = films.find((item) => item.id === filmId)
  const visibleFilms = useMemo(() => films.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())), [query])
  const subtotal = selectedSeats.length * 190000

  function switchFilm(id) {
    setFilmId(id)
    setShowtime(films.find((film) => film.id === id).shows[0])
    setSelectedSeats([])
    setNotice('')
  }

  function toggleSeat(seat) {
    if (unavailableSeats.has(seat)) return
    setNotice('')
    setSelectedSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat])
  }

  function continueToPayment() {
    if (!selectedSeats.length) {
      setNotice('Chọn ít nhất một ghế trước khi chuyển sang thanh toán.')
      return
    }
    navigate('/staff/pos/payment', { state: { film, showtime, seats: selectedSeats, total: subtotal } })
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-4 shadow-lg">
        <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Box office POS</p><h1 className="font-heading text-2xl font-bold">Sell tickets</h1></div>
        <div className="flex items-center gap-2 text-sm text-tertiary"><Clock3 className="size-4 text-secondary" /> Shift #04 · Counter #02</div>
      </header>
      <div className="grid gap-4 xl:grid-cols-12">
        <section className="space-y-3 xl:col-span-3">
          <div className="rounded-xl bg-surface-container-low p-4"><label className="relative block"><Search className="absolute left-3 top-3 size-4 text-tertiary" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg bg-surface-container-high py-2.5 pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2" placeholder="Search title..." /></label></div>
          <div className="space-y-2">{visibleFilms.map((item) => <button key={item.id} onClick={() => switchFilm(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${item.id === filmId ? 'border-primary-container bg-surface-container shadow-crimson' : 'border-transparent bg-surface-container-low hover:bg-surface-container'}`}><div className="flex items-start justify-between gap-2"><strong>{item.title}</strong><span className="rounded bg-primary-container px-1.5 py-0.5 text-xs font-bold text-white">{item.age}</span></div><p className="mt-1 text-xs text-tertiary">{item.genre} · {item.duration}</p><p className="mt-2 text-xs font-bold text-secondary">{item.shows.length} showtimes today</p></button>)}</div>
        </section>
        <section className="space-y-4 xl:col-span-5">
          <div className="rounded-xl bg-surface-container-low p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Selected movie</p><h2 className="font-heading text-xl font-bold">{film.title}</h2></div><span className="rounded-full bg-surface-container-high px-3 py-1 text-sm text-secondary">Hall 01 · IMAX 2D</span></div><div className="mt-5 flex flex-wrap gap-2">{film.shows.map((time) => <button key={time} onClick={() => setShowtime(time)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${showtime === time ? 'bg-primary-container text-white shadow-crimson' : 'bg-surface-container-high text-tertiary hover:text-on-surface'}`}>{time}</button>)}</div></div>
          <div className="rounded-xl bg-surface-container-low p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-heading text-lg font-bold">Choose seats</h2><span className="text-xs text-tertiary">Screen</span></div><div className="mx-auto mb-8 h-2 max-w-sm rounded-full bg-gradient-to-r from-transparent via-on-surface to-transparent opacity-50" /><div className="mx-auto grid max-w-md grid-cols-6 gap-2">{seatLabels.map((seat) => { const unavailable = unavailableSeats.has(seat); const active = selectedSeats.includes(seat); return <button key={seat} disabled={unavailable} onClick={() => toggleSeat(seat)} className={`aspect-square rounded-md text-xs font-bold transition ${unavailable ? 'cursor-not-allowed bg-surface-container-highest text-tertiary-container' : active ? 'bg-primary-container text-white shadow-crimson' : 'bg-secondary-container/20 text-secondary hover:bg-secondary-container/40'}`}>{seat}</button> })}</div><div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-tertiary"><span>■ Available</span><span className="text-primary">■ Selected</span><span className="text-tertiary-container">■ Unavailable</span></div></div>
        </section>
        <aside className="xl:col-span-4"><div className="sticky top-20 rounded-xl bg-surface-container-low p-5 shadow-xl"><p className="text-xs font-bold uppercase tracking-wider text-primary">Active ticket order</p><h2 className="mt-1 font-heading text-lg font-bold">{film.title}</h2><p className="mt-1 text-sm text-tertiary">Today · {showtime} · Hall 01</p><div className="my-5 space-y-2 border-y border-surface-container-high py-4">{selectedSeats.length ? selectedSeats.map((seat) => <div key={seat} className="flex justify-between text-sm"><span>VIP seat {seat}</span><span>{formatVnd(190000)}</span></div>) : <p className="text-sm text-tertiary">No seats selected.</p>}</div><div className="flex justify-between font-heading text-xl font-bold"><span>Total</span><span>{formatVnd(subtotal)}</span></div>{notice && <p role="alert" className="mt-4 rounded-lg bg-error-container/30 p-3 text-sm text-error">{notice}</p>}<button onClick={continueToPayment} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson transition hover:brightness-110"><Ticket className="size-5" /> Continue to payment</button><p className="mt-3 text-center text-xs text-tertiary">Seat availability will be confirmed by Booking service.</p></div></aside>
      </div>
    </div>
  )
}

export default CounterPosPage
