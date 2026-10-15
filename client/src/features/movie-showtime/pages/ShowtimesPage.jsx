import { useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Clock3, Film, MapPin, RefreshCw, Search, Ticket } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import ErrorState from '../../../components/common/ErrorState'
import { useShowtimes } from '../hooks/useShowtimes'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
})
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
})

function getVietnamDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${value.year}-${value.month}-${value.day}`
}

function getDateOptions() {
  const [year, month, day] = getVietnamDateKey().split('-').map(Number)
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1, day + offset, 12))
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      day: offset === 0 ? 'Today' : weekdayFormatter.format(date),
      date: dateFormatter.format(date),
    }
  })
}

const dateOptions = getDateOptions()
const timeRanges = [
  { label: 'All Day', value: 'all' },
  { label: 'Morning · before 12:00', value: 'morning' },
  { label: 'Afternoon · 12:00–17:00', value: 'afternoon' },
  { label: 'Prime Evening · 17:00–21:00', value: 'evening' },
  { label: 'Late Night · after 21:00', value: 'late' },
]

function getHour(dateString) {
  return Number(timeFormatter.format(new Date(dateString)).split(':')[0])
}

function isInTimeRange(dateString, range) {
  if (range === 'all') return true
  const hour = getHour(dateString)
  if (range === 'morning') return hour < 12
  if (range === 'afternoon') return hour >= 12 && hour < 17
  if (range === 'evening') return hour >= 17 && hour <= 21
  return hour > 21
}

function ShowtimesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const movieId = searchParams.get('movieId') || undefined
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key)
  const [selectedCinemaId, setSelectedCinemaId] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const [search, setSearch] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedShowtime, setSelectedShowtime] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const { data, error, loading } = useShowtimes({
    movieId,
    date: selectedDate,
    cinemaId: selectedCinemaId || undefined,
    refreshToken,
  })

  const showtimes = useMemo(() => data?.showtimes ?? [], [data?.showtimes])
  const cinemas = data?.cinemas ?? []
  const movie = data?.movie ?? showtimes[0]?.movie ?? location.state?.movie
  const formatOptions = useMemo(() => [
    'all',
    ...new Set(showtimes.map(({ room }) => room.roomType).filter(Boolean)),
  ], [showtimes])

  const filteredShowtimes = useMemo(() => showtimes.filter((showtime) => {
    const cinemaMatches = !search ||
      showtime.cinema.branchName.toLowerCase().includes(search.toLowerCase()) ||
      showtime.cinema.address.toLowerCase().includes(search.toLowerCase())
    const formatMatches = selectedFormat === 'all' || showtime.room.roomType === selectedFormat
    return cinemaMatches && formatMatches && isInTimeRange(showtime.startAt, timeRange)
  }), [search, selectedFormat, showtimes, timeRange])

  const showtimesByCinema = useMemo(() => {
    const groups = new Map()
    for (const showtime of filteredShowtimes) {
      const existing = groups.get(showtime.cinemaId) ?? { cinema: showtime.cinema, rooms: new Map() }
      const room = existing.rooms.get(showtime.roomId) ?? { room: showtime.room, showtimes: [] }
      room.showtimes.push(showtime)
      existing.rooms.set(showtime.roomId, room)
      groups.set(showtime.cinemaId, existing)
    }
    return [...groups.entries()].map(([id, group]) => ({
      id,
      ...group,
      rooms: [...group.rooms.values()],
    }))
  }, [filteredShowtimes])

  const handleContinue = () => {
    if (selectedShowtime) {
      navigate(`/booking/${selectedShowtime.id}/seats`, {
        state: { showtime: selectedShowtime },
      })
    }
  }

  return (
    <main className="min-h-screen bg-background pb-24 pt-20 text-on-surface xl:pb-12">
      <div className="border-b border-white/5 bg-surface-container-lowest px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Link to="/" className="transition-colors hover:text-white">Home</Link>
            <ChevronRight className="size-3" />
            <Link to="/movies" className="transition-colors hover:text-white">Movies</Link>
            <ChevronRight className="size-3" />
            <span className="font-medium text-primary">Showtimes &amp; Theatre Selection</span>
          </nav>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="grid size-5 place-items-center rounded-full bg-primary-container text-white">1</span> Showtime
            <span className="text-on-surface-variant">→</span><span className="text-on-surface-variant">2 · Seats</span>
            <span className="hidden text-on-surface-variant sm:inline">→ 3 · Payment</span>
          </div>
        </div>
      </div>

      <section className="border-b border-white/5 bg-gradient-to-r from-surface-container-lowest via-surface-container-low to-surface-container px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 sm:flex-row sm:items-center">
          {movie?.posterUrl ? (
            <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container-high shadow-xl sm:w-28">
              <img className="size-full object-cover" src={movie.posterUrl} alt={`${movie.title} poster`} />
            </div>
          ) : (
            <div className="grid aspect-[2/3] w-24 shrink-0 place-items-center rounded-xl bg-surface-container-high text-on-surface-variant sm:w-28">
              <Film className="size-8" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-secondary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">{movie ? 'Now Showing' : 'Live Schedule'}</span>
              {(movie?.genres ?? []).map((genre) => <span key={genre} className="rounded bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-tertiary-fixed">{genre}</span>)}
            </div>
            <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{movie?.title ?? 'Movie Showtimes'}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
              {movie?.duration && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-tertiary" />{movie.duration} min</span>}
              {movie?.ageRating && <span>{movie.ageRating}</span>}
              <span>Live schedule from F-Cinema branches</span>
            </div>
          </div>
          {movie && <Link to={`/movies/${movie.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-bright"><Film className="size-4 text-secondary" />Movie Details</Link>}
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] space-y-4">
          <div className="flex flex-col gap-3 border-b border-white/5 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {dateOptions.map((date) => <button key={date.key} type="button" onClick={() => { setSelectedDate(date.key); setSelectedShowtime(null) }} className={`min-w-[98px] rounded-lg px-3 py-2 text-center transition-colors ${selectedDate === date.key ? 'bg-primary-container text-white shadow-crimson' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}><span className={`block text-[10px] font-bold uppercase tracking-wider ${selectedDate === date.key ? 'text-white/75' : 'text-on-surface-variant'}`}>{date.day}</span><span className="block font-heading text-lg font-bold">{date.date}</span></button>)}
            </div>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setShowDatePicker((open) => !open)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-bright sm:w-auto"><CalendarDays className="size-4 text-secondary" />Select Another Date</button>
              {showDatePicker && <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-white/10 bg-surface-container p-4 shadow-2xl"><label className="mb-2 block text-xs font-semibold text-on-surface-variant" htmlFor="showtime-date">Select a show date</label><input id="showtime-date" type="date" min={getVietnamDateKey()} value={customDate} onChange={(event) => { setCustomDate(event.target.value); if (event.target.value) { setSelectedDate(event.target.value); setSelectedShowtime(null); setShowDatePicker(false) } }} className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary-container" /></div>}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/5 pb-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative block min-w-0 flex-1"><span className="sr-only">Search theatres</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search theatres or addresses..." className="w-full rounded-lg bg-surface-container-high py-2.5 pl-10 pr-9 text-xs text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary-container" /></label>
              <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2"><MapPin className="size-4 shrink-0 text-primary" /><span className="sr-only">Select a branch</span><select value={selectedCinemaId} onChange={(event) => { setSelectedCinemaId(event.target.value); setSelectedShowtime(null) }} className="min-w-0 flex-1 bg-transparent text-xs text-on-surface outline-none"><option value="" className="bg-surface-container">All active branches</option>{cinemas.map((cinema) => <option key={cinema.id} value={cinema.id} className="bg-surface-container">{cinema.branchName}</option>)}</select></label>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Format</span>{formatOptions.map((format) => <button key={format} type="button" onClick={() => setSelectedFormat(format)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors ${selectedFormat === format ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{format === 'all' ? 'All Formats' : format}</button>)}</div>
            <div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Time</span>{timeRanges.map((range) => <button key={range.value} type="button" onClick={() => setTimeRange(range.value)} className={`shrink-0 rounded px-3 py-1.5 text-xs transition-colors ${timeRange === range.value ? 'bg-surface-bright font-semibold text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{range.label}</button>)}</div>
          </div>

          {error ? (
            <div className="mx-auto max-w-2xl py-10 text-center">
              <ErrorState message={error} onRetry={() => setRefreshToken((value) => value + 1)} />
            </div>
          ) : loading ? (
            <div aria-label="Loading showtimes" className="grid gap-4 py-4 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-xl bg-surface-container-low" /><div className="h-64 animate-pulse rounded-xl bg-surface-container-low" /></div>
          ) : (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                {showtimesByCinema.map((cinema) => <article key={cinema.id} className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low">
                  <header className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div><h2 className="font-heading text-lg font-bold">{cinema.cinema.branchName}</h2><p className="mt-2 flex items-start gap-1.5 text-xs text-on-surface-variant"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />{cinema.cinema.address}</p></div>
                    <span className="shrink-0 rounded bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-on-surface-variant">{cinema.rooms.reduce((sum, room) => sum + room.showtimes.length, 0)} showtimes</span>
                  </header>
                  <div className="space-y-5 p-4 sm:p-5">
                    {cinema.rooms.map(({ room, showtimes: roomShowtimes }) => <section key={room.id}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-heading text-sm font-bold">{room.roomName}</h3><p className="mt-1 text-[11px] text-on-surface-variant">{room.roomType || 'Screening room'}</p></div></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{roomShowtimes.map((showtime) => {
                        const active = selectedShowtime?.id === showtime.id
                        const startsAt = timeFormatter.format(new Date(showtime.startAt))
                        return <button key={showtime.id} type="button" onClick={() => setSelectedShowtime(showtime)} className={`rounded-lg border p-3 text-left transition-all ${active ? 'border-primary-container bg-primary-container/10 shadow-crimson' : 'border-white/5 bg-surface-container hover:border-white/15 hover:bg-surface-container-high'}`}><span className={`block font-heading text-xl font-bold ${active ? 'text-primary' : 'text-on-surface'}`}>{startsAt}</span><span className="mt-1 block text-[10px] text-on-surface-variant">{showtime.movie.title}</span><span className={`mt-2 inline-flex rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${active ? 'bg-primary-container text-white' : 'bg-surface-bright text-on-surface'}`}>{active ? 'Selected' : showtime.displayStatus.replaceAll('_', ' ')}</span></button>
                      })}</div>
                    </section>)}
                  </div>
                </article>)}
                {showtimesByCinema.length === 0 && <div className="rounded-xl border border-dashed border-white/10 bg-surface-container-low p-10 text-center"><Ticket className="mx-auto size-7 text-on-surface-variant" /><h2 className="mt-3 font-heading text-lg font-bold">No showtimes found</h2><p className="mt-1 text-sm text-on-surface-variant">There are no published showtimes matching this date and branch.</p><button type="button" onClick={() => { setSearch(''); setSelectedCinemaId(''); setSelectedFormat('all'); setTimeRange('all'); setRefreshToken((value) => value + 1) }} className="mt-4 rounded-lg bg-surface-container-high px-4 py-2 text-xs font-semibold hover:bg-surface-bright">Clear Filters</button></div>}
              </div>

              <aside className="sticky top-24 hidden rounded-xl border border-white/10 bg-surface-container-low p-5 xl:block">
                <div className="flex items-center gap-2 border-b border-white/5 pb-4"><span className="grid size-9 place-items-center rounded-lg bg-primary-container/15 text-primary"><Ticket className="size-4" /></span><div><h2 className="font-heading text-sm font-bold">Your Selection</h2><p className="text-[10px] text-on-surface-variant">Review the session before continuing</p></div></div>
                {selectedShowtime ? <><div className="space-y-3 py-4 text-xs"><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Movie</p><p className="mt-1 font-semibold">{selectedShowtime.movie.title}</p></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Branch</p><p className="mt-1 font-semibold">{selectedShowtime.cinema.branchName}</p></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Date &amp; time</p><p className="mt-1 font-semibold">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(selectedShowtime.startAt))} · {timeFormatter.format(new Date(selectedShowtime.startAt))}</p></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Auditorium</p><p className="mt-1 font-semibold">{selectedShowtime.room.roomName} · {selectedShowtime.room.roomType || 'Screening room'}</p></div></div><button type="button" onClick={handleContinue} className="w-full rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-crimson transition hover:brightness-110">Continue to seat selection <ChevronRight className="ml-1 inline size-4" /></button></> : <p className="py-8 text-center text-xs text-on-surface-variant">Select a showtime to see its details.</p>}
                <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-bright"><RefreshCw className="size-3.5" />Refresh Showtimes</button>
              </aside>
            </div>
          )}
        </div>
      </section>
      {selectedShowtime && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-container-low/95 p-3 backdrop-blur xl:hidden"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{timeFormatter.format(new Date(selectedShowtime.startAt))} · {selectedShowtime.room.roomName}</p><p className="truncate text-[10px] text-on-surface-variant">{selectedShowtime.cinema.branchName}</p></div><button type="button" onClick={handleContinue} className="shrink-0 rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-white">Select Seats <ChevronRight className="ml-1 inline size-4" /></button></div></div>}
    </main>
  )
}

export default ShowtimesPage
