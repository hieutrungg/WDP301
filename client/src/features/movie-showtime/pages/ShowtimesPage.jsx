import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, Search, Star, Ticket, Film, ChevronRight, Map, Armchair, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { heroMovie } from '../data/movieMockData'

const dateOptions = [
  { day: 'Today', date: '15', count: '18 shows' },
  { day: 'Sat', date: '16', count: '24 shows' },
  { day: 'Sun', date: '17', count: '26 shows', note: 'Peak' },
  { day: 'Mon', date: '18', count: '14 shows', note: 'Members' },
  { day: 'Tue', date: '19', count: '16 shows' },
  { day: 'Wed', date: '20', count: '18 shows', note: 'Discount' },
  { day: 'Thu', date: '21', count: '12 shows' },
]

const cinemas = [
  {
    id: 'landmark', name: 'F-Cinema Landmark 81', distance: '1.2 km away', address: 'Level B1 & L1, Landmark 81 Tower, 720A Dien Bien Phu Street, Binh Thanh District, Ho Chi Minh City', featured: true,
    rooms: [
      { name: 'IMAX Laser 4K', detail: 'Auditorium 1 • 28m GT Screen', format: 'IMAX Laser 4K', shows: [
        { id: 'lm-1030', time: '10:30', room: 'Auditorium 1', fullness: 'Plenty of seats', price: '240,000 – 350,000 VND', status: 'AVAILABLE' },
        { id: 'lm-1415', time: '14:15', room: 'Auditorium 1', fullness: 'Selling fast', price: '240,000 – 350,000 VND', status: 'FEW_LEFT' },
        { id: 'lm-1800', time: '18:00', room: 'Auditorium 1', fullness: 'Selected', price: '240,000 – 350,000 VND', status: 'AVAILABLE' },
        { id: 'lm-2130', time: '21:30', room: 'Auditorium 1', fullness: 'Plenty of seats', price: '240,000 – 350,000 VND', status: 'AVAILABLE' },
      ] },
      { name: 'Dolby Atmos', detail: 'Auditorium 3 • Immersive surround sound', format: 'Dolby Atmos', shows: [
        { id: 'lm-1100', time: '11:00', room: 'Auditorium 3', fullness: 'Plenty of seats', price: '110,000 – 180,000 VND', status: 'AVAILABLE' },
        { id: 'lm-1530', time: '15:30', room: 'Auditorium 3', fullness: 'Plenty of seats', price: '110,000 – 180,000 VND', status: 'AVAILABLE' },
        { id: 'lm-1900', time: '19:00', room: 'Auditorium 3', fullness: 'Few seats left', price: '130,000 – 200,000 VND', status: 'FEW_LEFT' },
      ] },
    ],
  },
  {
    id: 'saigon-centre', name: 'F-Cinema Saigon Centre', distance: '3.8 km away', address: 'Level 6, Saigon Centre, 65 Le Loi Street, Ben Nghe Ward, District 1, Ho Chi Minh City', featured: false,
    rooms: [
      { name: 'ScreenX 270°', detail: 'Auditorium 5 • Panoramic screen experience', format: 'ScreenX 270°', shows: [
        { id: 'sc-1200', time: '12:00', room: 'Auditorium 5', fullness: 'Plenty of seats', price: '150,000 – 220,000 VND', status: 'AVAILABLE' },
        { id: 'sc-1630', time: '16:30', room: 'Auditorium 5', fullness: 'Plenty of seats', price: '150,000 – 220,000 VND', status: 'AVAILABLE' },
        { id: 'sc-2000', time: '20:00', room: 'Auditorium 5', fullness: 'Selling fast', price: '170,000 – 240,000 VND', status: 'FEW_LEFT' },
      ] },
      { name: 'Standard Digital 2D', detail: 'Auditorium 2 • Vietnamese subtitles', format: 'Standard 2D', shows: [
        { id: 'sc-0945', time: '09:45', room: 'Auditorium 2', fullness: 'Plenty of seats', price: '85,000 – 120,000 VND', status: 'AVAILABLE' },
        { id: 'sc-1330', time: '13:30', room: 'Auditorium 2', fullness: 'Plenty of seats', price: '85,000 – 120,000 VND', status: 'AVAILABLE' },
        { id: 'sc-1745', time: '17:45', room: 'Auditorium 2', fullness: 'Few seats left', price: '105,000 – 145,000 VND', status: 'FEW_LEFT' },
      ] },
    ],
  },
]

const regions = ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Can Tho', 'Nha Trang']
const formats = ['All Formats', 'IMAX Laser 4K', 'Dolby Atmos', 'ScreenX 270°', 'Gold Class VIP']
const timeRanges = [
  { label: 'All Day', value: 'all' },
  { label: 'Morning · before 12:00', value: 'morning' },
  { label: 'Afternoon · 12:00–17:00', value: 'afternoon' },
  { label: 'Prime Evening · 17:00–21:00', value: 'evening' },
  { label: 'Late Night · after 21:00', value: 'late' },
]

function isInTimeRange(time, range) {
  if (range === 'all') return true
  const hour = Number(time.split(':')[0])
  if (range === 'morning') return hour < 12
  if (range === 'afternoon') return hour >= 12 && hour < 17
  if (range === 'evening') return hour >= 17 && hour <= 21
  return hour > 21
}

function ShowtimesPage() {
  const [selectedDate, setSelectedDate] = useState('15')
  const [selectedRegion, setSelectedRegion] = useState(regions[0])
  const [selectedFormat, setSelectedFormat] = useState(formats[0])
  const [timeRange, setTimeRange] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedShow, setSelectedShow] = useState({ cinemaId: 'landmark', roomName: 'IMAX Laser 4K', showId: 'lm-1800', time: '18:00', room: 'Auditorium 1', price: '240,000 – 350,000 VND' })
  const [customDate, setCustomDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const filteredCinemas = useMemo(() => cinemas.map((cinema) => ({
    ...cinema,
    rooms: cinema.rooms.filter((room) => selectedFormat === formats[0] || room.format === selectedFormat).map((room) => ({
      ...room,
      shows: room.shows.filter((show) => isInTimeRange(show.time, timeRange)),
    })).filter((room) => room.shows.length > 0),
  })).filter((cinema) => selectedRegion === regions[0] && (cinema.name.toLowerCase().includes(search.toLowerCase()) || cinema.address.toLowerCase().includes(search.toLowerCase()))).filter((cinema) => cinema.rooms.length > 0), [search, selectedFormat, timeRange, selectedRegion])

  const activeShow = cinemas.flatMap((cinema) => cinema.rooms.flatMap((room) => room.shows.map((show) => ({ ...show, cinema, roomGroup: room })))).find((show) => show.id === selectedShow?.showId)
  const selectedDateLabel = selectedDate.includes('-')
    ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${selectedDate}T12:00:00Z`))
    : `Mar ${selectedDate}`

  const chooseShow = (cinema, room, show) => setSelectedShow({ cinemaId: cinema.id, roomName: room.name, showId: show.id, time: show.time, room: show.room, price: show.price })

  const handleContinue = () => {
    if (!selectedShow) {
      toast.error('Please select a showtime first.')
      return
    }
    toast('Seat selection will be available in a later update.', { description: `${selectedShow.time} · ${selectedShow.roomName}` })
  }

  return (
    <main className="min-h-screen bg-background pb-12 pt-20 text-on-surface">
      <div className="border-b border-white/5 bg-surface-container-lowest px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Link to="/" className="transition-colors hover:text-white">Home</Link><ChevronRight className="size-3" />
            <Link to="/" className="transition-colors hover:text-white">Movies</Link><ChevronRight className="size-3" />
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
          <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container-high shadow-xl sm:w-28">
            <img className="size-full object-cover" src={heroMovie.backdrop} alt="Dune: Part Two movie poster" />
            <span className="absolute left-2 top-2 rounded bg-primary-container px-1.5 py-1 text-[10px] font-bold text-white">T16</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-secondary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">Now Showing</span>
              {heroMovie.formats.map((format) => <span key={format} className="rounded bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-tertiary-fixed">{format}</span>)}
            </div>
            <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{heroMovie.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5"><Film className="size-3.5 text-tertiary" />Sci-Fi, Action</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-tertiary" />166 min</span>
              <span className="inline-flex items-center gap-1.5"><Star className="size-3.5 fill-secondary text-secondary" />{heroMovie.score}/10</span>
              <span>English audio · Vietnamese subtitles</span>
            </div>
          </div>
          <Link to="/" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-bright"><Film className="size-4 text-secondary" />Change Movie</Link>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] space-y-4">
          <div className="flex flex-col gap-3 border-b border-white/5 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {dateOptions.map((date) => <button key={date.date} type="button" onClick={() => setSelectedDate(date.date)} className={`min-w-[98px] rounded-lg px-3 py-2 text-center transition-colors ${selectedDate === date.date ? 'bg-primary-container text-white shadow-crimson' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}><span className={`block text-[10px] font-bold uppercase tracking-wider ${selectedDate === date.date ? 'text-white/75' : 'text-on-surface-variant'}`}>{date.day}</span><span className="block font-heading text-lg font-bold">Mar {date.date}</span><span className={`block text-[9px] font-semibold ${selectedDate === date.date ? 'text-white/75' : 'text-secondary'}`}>{date.count}{date.note ? ` · ${date.note}` : ''}</span></button>)}
            </div>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setShowDatePicker((open) => !open)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-bright sm:w-auto"><CalendarDays className="size-4 text-secondary" />Select Another Date</button>
              {showDatePicker && <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-white/10 bg-surface-container p-4 shadow-2xl"><label className="mb-2 block text-xs font-semibold text-on-surface-variant" htmlFor="showtime-date">Select a show date</label><input id="showtime-date" type="date" value={customDate} onChange={(event) => { setCustomDate(event.target.value); if (event.target.value) { setSelectedDate(event.target.value); setShowDatePicker(false) } }} className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary-container" /></div>}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Region</span>{regions.map((region) => <button key={region} type="button" onClick={() => setSelectedRegion(region)} className={`shrink-0 rounded px-3 py-1.5 text-xs transition-colors ${selectedRegion === region ? 'bg-on-surface font-bold text-background' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}><MapPin className="mr-1 inline size-3" />{region}</button>)}</div>
            <div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Format</span>{formats.map((format) => <button key={format} type="button" onClick={() => setSelectedFormat(format)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors ${selectedFormat === format ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{format}</button>)}</div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Showtime</span>{timeRanges.map((range) => <button key={range.value} type="button" onClick={() => setTimeRange(range.value)} className={`shrink-0 rounded px-3 py-1.5 text-xs transition-colors ${timeRange === range.value ? 'bg-surface-bright font-semibold text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{range.label}</button>)}</div>
              <label className="relative block w-full xl:max-w-xs"><span className="sr-only">Search theatres</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search theatres or addresses..." className="w-full rounded-lg bg-surface-container-high py-2.5 pl-10 pr-9 text-xs text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary-container" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white"><X className="size-4" /></button>}</label>
            </div>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-xs text-on-surface-variant"><span className="mt-0.5 rounded-full bg-secondary/15 p-1.5 text-secondary"><Ticket className="size-4" /></span><p><strong className="text-secondary">High demand:</strong> Weekend IMAX evening sessions are filling up quickly. Select your seats early for the best choice.</p></div>
              {filteredCinemas.map((cinema) => <article key={cinema.id} className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low">
                <header className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-bold">{cinema.name}</h2>{cinema.featured && <span className="rounded bg-secondary/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-secondary"><Star className="mr-1 inline size-3 fill-current" />Featured</span>}</div><p className="mt-1 text-[11px] text-on-surface-variant">{cinema.distance}</p><p className="mt-2 flex items-start gap-1.5 text-xs text-on-surface-variant"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />{cinema.address}</p></div>
                  <button type="button" onClick={() => toast('Theatre directions will be available when branch data is connected.')} className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-surface-container-high px-3 py-2 text-xs font-semibold transition-colors hover:bg-surface-bright sm:self-center"><Map className="size-3.5 text-secondary" />Map &amp; Directions</button>
                </header>
                <div className="space-y-5 p-4 sm:p-5">
                  {cinema.rooms.map((room) => <section key={room.name}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-heading text-sm font-bold">{room.name}</h3><p className="mt-1 text-[11px] text-on-surface-variant">{room.detail}</p></div><span className="rounded bg-surface-container-high px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-tertiary-fixed">{room.format}</span></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{room.shows.map((show) => {
                      const isSelected = selectedShow?.showId === show.id
                      return <button key={show.id} type="button" onClick={() => chooseShow(cinema, room, show)} className={`rounded-lg border p-3 text-left transition-all ${isSelected ? 'border-primary-container bg-primary-container/10 shadow-crimson' : 'border-white/5 bg-surface-container hover:border-white/15 hover:bg-surface-container-high'}`}>
                        <span className={`block font-heading text-xl font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{show.time}</span><span className="mt-1 block text-[10px] text-on-surface-variant">{show.room} · {show.fullness}</span><span className="mt-1 block text-[10px] font-semibold text-on-surface-variant">{show.price}</span><span className={`mt-2 inline-flex rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${show.status === 'FEW_LEFT' ? 'bg-secondary/15 text-secondary' : isSelected ? 'bg-primary-container text-white' : 'bg-surface-bright text-on-surface'}`}>{isSelected ? 'Selected' : show.status === 'FEW_LEFT' ? 'Selling Fast' : 'Available'}</span>
                      </button>
                    })}</div>
                  </section>)}
                </div>
              </article>)}
              {filteredCinemas.length === 0 && <div className="rounded-xl border border-dashed border-white/10 bg-surface-container-low p-10 text-center"><Search className="mx-auto size-7 text-on-surface-variant" /><h2 className="mt-3 font-heading text-lg font-bold">No showtimes found</h2><p className="mt-1 text-sm text-on-surface-variant">Try changing the format, time, or theatre search.</p><button type="button" onClick={() => { setSearch(''); setSelectedFormat(formats[0]); setTimeRange('all') }} className="mt-4 rounded-lg bg-surface-container-high px-4 py-2 text-xs font-semibold hover:bg-surface-bright">Clear Filters</button></div>}
            </div>

            <aside className="sticky top-24 hidden rounded-xl border border-white/10 bg-surface-container-low p-5 xl:block">
              <div className="flex items-center gap-2 border-b border-white/5 pb-4"><span className="grid size-9 place-items-center rounded-lg bg-primary-container/15 text-primary"><Ticket className="size-4" /></span><div><h2 className="font-heading text-sm font-bold">Your Selection</h2><p className="text-[10px] text-on-surface-variant">Review your selection before continuing</p></div></div>
              {selectedShow ? <><div className="space-y-3 py-4 text-xs"><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Movie</p><p className="mt-1 font-semibold">{heroMovie.title}</p></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Theatre</p><p className="mt-1 font-semibold">{activeShow?.cinema.name || cinemas.find((cinema) => cinema.id === selectedShow.cinemaId)?.name}</p></div><div className="grid grid-cols-2 gap-3"><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Date</p><p className="mt-1 font-semibold">{selectedDateLabel}</p></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Time</p><p className="mt-1 font-semibold">{selectedShow.time}</p></div></div><div><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Auditorium / format</p><p className="mt-1 font-semibold">{selectedShow.room} · {selectedShow.roomName}</p></div><div className="rounded-lg bg-surface-container-high p-3"><div className="flex items-center gap-2 text-on-surface-variant"><Armchair className="size-4 text-secondary" /><span className="text-[11px]">Ticket price range</span></div><p className="mt-1 font-heading text-lg font-bold text-secondary">{selectedShow.price}</p></div></div><button type="button" onClick={handleContinue} className="w-full rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-crimson transition hover:brightness-110">Continue to seat selection <ChevronRight className="ml-1 inline size-4" /></button><p className="mt-3 text-center text-[10px] leading-4 text-on-surface-variant">Seats are held after you complete seat selection.</p></> : <p className="py-8 text-center text-xs text-on-surface-variant">Select a showtime to see its details.</p>}
            </aside>
          </div>
        </div>
      </section>
      {selectedShow && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-container-low/95 p-3 backdrop-blur xl:hidden"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{selectedShow.time} · {selectedShow.roomName}</p><p className="truncate text-[10px] text-on-surface-variant">{cinemas.find((cinema) => cinema.id === selectedShow.cinemaId)?.name}</p></div><button type="button" onClick={handleContinue} className="shrink-0 rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-white">Select Seats <ChevronRight className="ml-1 inline size-4" /></button></div></div>}
    </main>
  )
}

export default ShowtimesPage
