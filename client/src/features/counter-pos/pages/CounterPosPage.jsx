import { Fragment, useEffect, useMemo, useState } from 'react'
import { Clock3, LoaderCircle, Minus, Plus, Popcorn, RefreshCw, Search, Ticket, TimerReset, UnlockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useMovies } from '../../movie-showtime/hooks/useMovies'
import { useShowtimes } from '../../movie-showtime/hooks/useShowtimes'
import SeatButton from '../../seat-selection/components/SeatButton'
import SeatLegend from '../../seat-selection/components/SeatLegend'
import { useAcquireSeatHold, useReleaseSeatHold, useSeatAvailability } from '../../seat-selection/hooks/useSeatAvailability'
import { formatSeatMoney, hasValidSeatPrice, sumSeatPrices } from '../../seat-selection/utils/seatPricing'
import { createPendingBooking, quoteConcessions } from '../../booking/api/bookingApi'
import { useCatalogPage } from '../../concessions/hooks/useConcessionCatalog'
import { CatalogBadges, CatalogImage } from '../../concessions/components/CatalogCard'

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' })
const timeFmt = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

function vietnamDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function HoldCountdown({ hold, onExpire }) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const expires = new Date(hold.expiresAt).getTime()
    const serverStart = new Date(hold.serverNow).getTime()
    const clientStart = Date.now()
    let notified = false
    const update = () => {
      const value = Math.max(0, expires - (serverStart + Date.now() - clientStart))
      setRemaining(value)
      if (value === 0 && !notified) { notified = true; onExpire() }
    }
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [hold, onExpire])
  const seconds = Math.ceil(remaining / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function SeatMatrix({ rows, selected, locked, onToggle }) {
  return <div className="rounded-xl bg-surface-container-low p-5">
    <div className="mb-6 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Cinema screen</p><div className="mx-auto mt-2 h-1.5 max-w-lg rounded-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" /></div>
    <div className="overflow-x-auto pb-2"><div className="mx-auto flex min-w-max flex-col gap-2.5">{rows.map(([row, seats]) => <div key={row} className="flex items-center gap-3"><span className="w-6 text-center font-mono text-xs font-bold text-on-surface-variant">{row}</span><div className="flex gap-1.5">{seats.map((seat, index) => <Fragment key={seat.seatId}>{index === Math.ceil(seats.length / 2) && <span className="w-4" />}<SeatButton seat={seat} selected={selected.includes(seat.seatId)} disabled={locked || !hasValidSeatPrice(seat.price)} onToggle={onToggle} /></Fragment>)}</div><span className="w-6 text-center font-mono text-xs font-bold text-on-surface-variant">{row}</span></div>)}</div></div>
  </div>
}

function CounterPosPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(vietnamDateKey)
  const [movieId, setMovieId] = useState('')
  const [showtimeId, setShowtimeId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [hold, setHold] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [foodOpen, setFoodOpen] = useState(false)
  const [foodKind, setFoodKind] = useState('items')
  const [foodItems, setFoodItems] = useState([])
  const [foodContext, setFoodContext] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  // The public Movie contract caps a page at 24. Sending 50 made every Staff
  // POS request fail validation before any movie could be displayed.
  const movieQuery = useMemo(() => new URLSearchParams({ limit: '24', ...(query.trim() ? { q: query.trim() } : {}) }).toString(), [query])
  const movies = useMovies(movieQuery)
  const schedule = useShowtimes({ movieId: movieId || undefined, date, refreshToken: refresh })
  const availability = useSeatAvailability(showtimeId)
  const acquire = useAcquireSeatHold(showtimeId)
  const release = useReleaseSeatHold(showtimeId)
  const selectedMovie = movies.movies.find((movie) => movie.id === movieId)
  const showtimes = useMemo(() => movieId ? (schedule.data?.showtimes ?? []).filter((item) => item.movieId === movieId) : [], [movieId, schedule.data?.showtimes])
  const selectedShowtime = showtimes.find((item) => item.id === showtimeId) ?? availability.data?.showtime
  const seats = useMemo(() => availability.data?.seats ?? [], [availability.data?.seats])
  const seatMap = useMemo(() => new Map(seats.map((seat) => [seat.seatId, seat])), [seats])
  const selectedSeats = selectedIds.map((id) => seatMap.get(id)).filter(Boolean)
  const selectedTotal = sumSeatPrices(selectedSeats)
  const total = hold?.priceQuote?.totalAmount ?? selectedTotal ?? 0
  const catalog = useCatalogPage({ kind: foodKind, branchId: foodContext?.branchId, page: 1, limit: 24 }, refresh, Boolean(foodOpen && foodContext?.branchId))
  const foodCount = foodItems.reduce((sum, line) => sum + line.quantity, 0)
  const rows = useMemo(() => {
    const groups = new Map()
    seats.forEach((seat) => { if (!groups.has(seat.row)) groups.set(seat.row, []); groups.get(seat.row).push(seat) })
    return [...groups.entries()].map(([row, values]) => [row, values.sort((a, b) => Number(a.number) - Number(b.number))])
  }, [seats])
  const seatTypes = useMemo(() => {
    const values = new Map()
    seats.forEach((seat) => { if (hasValidSeatPrice(seat.price)) values.set(`${seat.type}:${seat.price}`, { ...seat, formattedPrice: formatSeatMoney(seat.price) }) })
    return [...values.values()]
  }, [seats])

  const chooseMovie = (id) => { if (!hold) { setMovieId(id); setShowtimeId(''); setSelectedIds([]) } }
  const chooseShowtime = (id) => { if (!hold) { setShowtimeId(id); setSelectedIds([]) } }
  const toggleSeat = (id) => {
    const seat = seatMap.get(id)
    if (hold || seat?.availability !== 'AVAILABLE' || !hasValidSeatPrice(seat?.price)) return
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }
  const holdSeats = async () => {
    try {
      const result = await acquire.mutateAsync({ showtimeId, seatIds: selectedIds, checkoutKey: `counter-${crypto.randomUUID()}` })
      setHold(result)
      toast.success('Seats are held with the server-confirmed price.')
    } catch (error) { toast.error(getApiErrorMessage(error)); availability.refetch() }
  }
  const expireHold = () => { setHold(null); setSelectedIds([]); availability.refetch(); toast.error('The seat hold expired. Availability was refreshed.') }
  const releaseSeats = async () => {
    try { await release.mutateAsync(hold.holdId); setHold(null); setSelectedIds([]); setFoodOpen(false); setFoodItems([]); setFoodContext(null); toast.success('Seat hold released.') }
    catch (error) { toast.error(getApiErrorMessage(error)) }
  }

  const openFood = async () => {
    setFoodOpen(true)
    if (foodContext || !hold) return
    try { setFoodContext(await quoteConcessions({ holdId: hold.holdId, items: [] })) }
    catch (error) { toast.error(getApiErrorMessage(error)) }
  }
  const changeFood = (item, delta) => {
    const itemType = foodKind === 'combos' ? 'COMBO' : 'CONCESSION'
    const key = `${itemType}:${item.id}`
    const existing = foodItems.find((line) => `${line.itemType}:${line.itemId}` === key)
    const quantity = Math.max(0, Math.min(100, (existing?.quantity ?? 0) + delta))
    setFoodItems((current) => [
      ...current.filter((line) => `${line.itemType}:${line.itemId}` !== key),
      ...(quantity ? [{ itemType, itemId: item.id, quantity }] : []),
    ])
  }
  const proceedToPayment = async (skipFood = false) => {
    if (!hold || checkoutBusy) return
    setCheckoutBusy(true)
    try {
      let concessionSelection
      let concessionQuote
      if (!skipFood && foodItems.length) {
        concessionQuote = await quoteConcessions({ holdId: hold.holdId, items: foodItems })
        concessionSelection = {
          items: concessionQuote.items.map(({ itemType, itemId, quantity }) => ({ itemType, itemId, quantity })),
          quoteReference: concessionQuote.quoteReference,
        }
      }
      const booking = await createPendingBooking({
        holdId: hold.holdId,
        requestKey: `counter-${hold.holdId}`,
        priceQuoteReference: hold.priceQuote?.quoteId,
        concessionSelection,
      })
      navigate('/staff/pos/payment', {
        state: {
          booking,
          film: selectedMovie,
          showtime: selectedShowtime,
          seats: selectedSeats,
          concessionQuote,
          total: booking.amount,
        },
      })
    } catch (error) { toast.error(getApiErrorMessage(error)) }
    finally { setCheckoutBusy(false) }
  }

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-4 shadow-lg"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Box office POS</p><h1 className="font-heading text-2xl font-bold">Sell tickets</h1><p className="mt-1 text-xs text-on-surface-variant">Live movie, showtime, availability and SeatHold data</p></div><div className="flex flex-wrap items-center gap-2"><Link to="/staff/concessions" className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-bright"><Popcorn className="size-4 text-secondary" /> Open F&amp;B menu</Link><div className="flex items-center gap-2 text-sm text-tertiary"><Clock3 className="size-4 text-secondary" /> Staff counter</div></div></header>
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="space-y-3 xl:col-span-3">
        <div className="rounded-xl bg-surface-container-low p-4"><label className="relative block"><span className="sr-only">Search movie title</span><Search className="absolute left-3 top-3 size-4 text-tertiary" /><input value={query} disabled={Boolean(hold)} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg bg-surface-container-high py-2.5 pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-50" placeholder="Search title..." /></label></div>
        {movies.loading && <div className="rounded-xl bg-surface-container-low p-6 text-center text-sm text-tertiary"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />Loading movies…</div>}
        {!movies.loading && movies.error && <ErrorState message={movies.error} onRetry={movies.retry} />}
        {!movies.loading && !movies.error && movies.movies.length === 0 && <EmptyState title="No movies found" description="No published movie matches this search." />}
        <div className="space-y-2">{movies.movies.map((movie) => <button key={movie.id} type="button" disabled={Boolean(hold)} onClick={() => chooseMovie(movie.id)} className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-60 ${movie.id === movieId ? 'border-primary-container bg-surface-container shadow-crimson' : 'border-transparent bg-surface-container-low hover:bg-surface-container'}`}><div className="flex items-start gap-3">{movie.posterUrl && <img src={movie.posterUrl} alt="" className="h-16 w-11 rounded object-cover" />}<div className="min-w-0"><strong className="line-clamp-2">{movie.title}</strong><p className="mt-1 text-xs text-tertiary">{movie.genres?.join(', ') || 'Movie'} · {movie.duration} min</p><p className="mt-2 text-xs font-bold text-secondary">{movie.ageRating}</p></div></div></button>)}</div>
      </section>

      <section className="space-y-4 xl:col-span-5">
        <div className="rounded-xl bg-surface-container-low p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Showtime</p><h2 className="font-heading text-xl font-bold">{selectedMovie?.title ?? 'Select a movie'}</h2></div><label className="text-xs text-on-surface-variant">Show date<input type="date" min={vietnamDateKey()} value={date} disabled={Boolean(hold)} onChange={(event) => { setDate(event.target.value); setShowtimeId(''); setSelectedIds([]) }} className="ml-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface disabled:opacity-50" /></label></div>
          {movieId && schedule.loading && <p className="mt-5 flex items-center gap-2 text-sm text-tertiary"><LoaderCircle className="size-4 animate-spin" />Loading showtimes…</p>}
          {movieId && !schedule.loading && schedule.error && <div className="mt-4"><ErrorState message={schedule.error} onRetry={() => setRefresh((value) => value + 1)} /></div>}
          {movieId && !schedule.loading && !schedule.error && showtimes.length === 0 && <p className="mt-5 rounded-lg border border-dashed border-white/10 p-4 text-sm text-tertiary">No published future showtimes for this movie and date.</p>}
          <div className="mt-5 flex flex-wrap gap-2">{showtimes.map((item) => <button key={item.id} type="button" disabled={Boolean(hold)} onClick={() => chooseShowtime(item.id)} className={`rounded-lg px-4 py-2 text-left text-sm font-semibold disabled:opacity-60 ${showtimeId === item.id ? 'bg-primary-container text-white shadow-crimson' : 'bg-surface-container-high text-tertiary hover:text-on-surface'}`}><span className="block">{timeFmt.format(new Date(item.startAt))}</span><span className="mt-1 block text-[10px] font-normal">{item.room.roomName} · {item.cinema.branchName}</span></button>)}</div>
        </div>
        {showtimeId && availability.isPending && <div className="rounded-xl bg-surface-container-low p-10 text-center text-sm text-tertiary"><LoaderCircle className="mx-auto mb-3 size-7 animate-spin" />Loading live seat availability…</div>}
        {showtimeId && availability.isError && <ErrorState message={getApiErrorMessage(availability.error)} onRetry={availability.refetch} />}
        {showtimeId && availability.isSuccess && seats.length === 0 && <EmptyState title="No seats available" description="This showtime has no initialized seat layout." />}
        {showtimeId && availability.isSuccess && seats.length > 0 && <><div className="rounded-xl bg-surface-container-low p-4"><SeatLegend seatTypes={seatTypes} selectedCount={selectedIds.length} /></div><SeatMatrix rows={rows} selected={selectedIds} locked={Boolean(hold)} onToggle={toggleSeat} /></>}
      </section>

      <aside className="xl:col-span-4"><div className="sticky top-20 rounded-xl bg-surface-container-low p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Counter order</p><h2 className="mt-1 font-heading text-lg font-bold">{selectedMovie?.title ?? 'No movie selected'}</h2></div>{hold && <span className="rounded bg-secondary/15 px-2 py-1 text-[10px] font-bold uppercase text-secondary">Held</span>}</div>
        {selectedShowtime && <p className="mt-1 text-sm text-tertiary">{dateFmt.format(new Date(selectedShowtime.startAt))} · {timeFmt.format(new Date(selectedShowtime.startAt))}<br />{selectedShowtime.room?.roomName} · {selectedShowtime.cinema?.branchName}</p>}
        <div className="my-5 space-y-2 border-y border-surface-container-high py-4">{selectedSeats.length ? selectedSeats.map((seat) => <div key={seat.seatId} className="flex justify-between gap-3 text-sm"><span>{seat.type.replaceAll('_', ' ')} · {seat.row}{seat.number}</span><span>{formatSeatMoney(seat.price)}</span></div>) : <p className="text-sm text-tertiary">Select a movie, showtime and at least one available seat.</p>}</div>
        <div className="flex justify-between font-heading text-xl font-bold"><span>Total</span><span>{formatSeatMoney(total)}</span></div><p className="mt-1 text-right text-[10px] text-on-surface-variant">{hold ? 'Confirmed by SeatHold price snapshot' : 'Calculated from current showtime seat prices'}</p>
        {hold ? <div className="mt-5 space-y-3"><div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-secondary">SeatHold active</p><p className="mt-2 flex items-center gap-2 font-heading text-2xl font-bold text-secondary"><TimerReset className="size-5" /><HoldCountdown hold={hold} onExpire={expireHold} /></p><p className="mt-2 break-all font-mono text-[10px] text-on-surface-variant">Hold ID: {hold.holdId}</p></div><button type="button" onClick={openFood} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-bold"><Popcorn className="size-5" /> Browse F&amp;B{foodCount ? ` (${foodCount})` : ''}</button>{foodItems.length ? <button type="button" disabled={checkoutBusy} onClick={() => proceedToPayment(false)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson disabled:opacity-50"><Ticket className="size-5" />{checkoutBusy ? 'Preparing checkout…' : 'Continue to payment'}</button> : <button type="button" disabled={checkoutBusy} onClick={() => proceedToPayment(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson disabled:opacity-50"><Ticket className="size-5" />{checkoutBusy ? 'Preparing checkout…' : 'Skip F&B & continue'}</button>}<button type="button" disabled={release.isPending || checkoutBusy} onClick={releaseSeats} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-bold disabled:opacity-50"><UnlockKeyhole className="size-5" />{release.isPending ? 'Releasing…' : 'Release seats'}</button></div> : <button type="button" disabled={!showtimeId || !selectedIds.length || selectedTotal === null || acquire.isPending} onClick={holdSeats} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson disabled:opacity-45"><Ticket className="size-5" />{acquire.isPending ? 'Holding seats…' : 'Hold selected seats'}</button>}
        {showtimeId && !hold && <button type="button" onClick={() => availability.refetch()} className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-semibold text-tertiary hover:text-on-surface"><RefreshCw className="size-3.5" />Refresh availability</button>}
      </div></aside>
    </div>
    {hold && foodOpen && <section className="rounded-xl bg-surface-container-low p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-secondary">Optional add-on</p><h2 className="font-heading text-xl font-bold">Food &amp; drink</h2><p className="mt-1 text-sm text-tertiary">{foodContext?.branchName ?? 'Loading the menu for this cinema…'}</p></div><div className="flex gap-2">{['items', 'combos'].map((kind) => <button key={kind} type="button" onClick={() => setFoodKind(kind)} className={`rounded-lg px-4 py-2 text-sm font-bold ${foodKind === kind ? 'bg-primary-container text-white' : 'bg-surface-container-high text-tertiary'}`}>{kind === 'items' ? 'Items' : 'Combos'}</button>)}</div></div>{catalog.loading && <p className="mt-5 text-sm text-tertiary">Loading F&amp;B…</p>}{catalog.error && <ErrorState message={getApiErrorMessage(catalog.error)} onRetry={() => setRefresh((value) => value + 1)} />}<div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{(catalog.data?.items ?? []).map((item) => { const type = foodKind === 'combos' ? 'COMBO' : 'CONCESSION'; const quantity = foodItems.find((line) => line.itemType === type && line.itemId === item.id)?.quantity ?? 0; return <article key={item.id} className="overflow-hidden rounded-xl bg-surface-container-lowest"><CatalogImage item={item} combo={foodKind === 'combos'} /><div className="p-4"><div className="flex flex-wrap gap-2"><CatalogBadges item={item} /></div><h3 className="mt-3 font-bold">{item.name}</h3><p className="mt-1 text-sm text-secondary">{formatSeatMoney(item.price)}</p><div className="mt-4 flex items-center justify-between"><button type="button" disabled={!quantity} onClick={() => changeFood(item, -1)} className="grid size-9 place-items-center rounded-lg bg-surface-container-high disabled:opacity-40"><Minus className="size-4" /></button><strong>{quantity}</strong><button type="button" disabled={!item.available} onClick={() => changeFood(item, 1)} className="grid size-9 place-items-center rounded-lg bg-primary-container text-white disabled:opacity-40"><Plus className="size-4" /></button></div></div></article> })}</div></section>}
  </div>
}

export default CounterPosPage
