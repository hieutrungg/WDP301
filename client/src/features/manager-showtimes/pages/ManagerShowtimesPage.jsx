import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Armchair,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Film,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Pencil,
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { cancelManagerShowtime, createManagerShowtime, rescheduleManagerShowtime } from '../api/managerShowtimeApi'
import { useManagerSchedule } from '../hooks/useManagerSchedule'

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
})
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const sessionDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const weekDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: 'numeric', month: 'short',
})
const calendarRoomColors = [
  { background: 'rgba(239, 68, 68, .18)', border: '#ef4444' },
  { background: 'rgba(59, 130, 246, .18)', border: '#3b82f6' },
  { background: 'rgba(34, 197, 94, .18)', border: '#22c55e' },
  { background: 'rgba(234, 179, 8, .18)', border: '#eab308' },
  { background: 'rgba(168, 85, 247, .18)', border: '#a855f7' },
  { background: 'rgba(6, 182, 212, .18)', border: '#06b6d4' },
]

function getTodayInVietnam() {
  return vietnamDateFormatter.format(new Date())
}

function getWeekDates(date) {
  const [year, month, day] = date.split('-').map(Number)
  const monday = new Date(Date.UTC(year, month - 1, day, 12))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(monday)
    value.setUTCDate(monday.getUTCDate() + index)
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  })
}

function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days, 12))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

function localDateKey(date) {
  return vietnamDateFormatter.format(date)
}

function vietnamMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function ShowtimeWeekCalendar({ date, cinema, showtimes, onDetails, onMore }) {
  const weekDates = getWeekDates(date)
  const roomColors = new Map()
  let nextColor = 0
  const dayEvents = weekDates.map((weekDate) => {
    const events = showtimes
      .filter((showtime) => localDateKey(new Date(showtime.startAt)) === weekDate)
      .map((showtime) => {
        const roomId = showtime.room.id
        if (!roomColors.has(roomId)) {
          roomColors.set(roomId, calendarRoomColors[nextColor % calendarRoomColors.length])
          nextColor += 1
        }
        const start = new Date(showtime.startAt)
        const end = new Date(showtime.endAt)
        const startMinutes = vietnamMinutes(start)
        const endLocalDate = localDateKey(end)
        const rawEndMinutes = vietnamMinutes(end)
        const endMinutes = endLocalDate === weekDate ? rawEndMinutes : 24 * 60
        return { showtime, startMinutes, endMinutes: Math.max(startMinutes + 30, endMinutes), color: roomColors.get(roomId) }
      })
      .sort((a, b) => a.startMinutes - b.startMinutes)

    const clusters = []
    for (const event of events) {
      const cluster = clusters.at(-1)
      if (!cluster || event.startMinutes >= cluster.endMinutes) {
        clusters.push({ endMinutes: event.endMinutes, events: [event] })
      } else {
        cluster.endMinutes = Math.max(cluster.endMinutes, event.endMinutes)
        cluster.events.push(event)
      }
    }
    const positioned = clusters.flatMap((cluster) => {
      const laneEnds = []
      const placed = cluster.events.map((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.startMinutes)
        if (lane < 0) lane = laneEnds.length
        laneEnds[lane] = event.endMinutes
        return { ...event, lane }
      })
      return placed.map((event) => ({ ...event, laneCount: Math.min(laneEnds.length, 2), overflow: laneEnds.length > 2 ? placed.filter((item) => item.lane >= 2) : [] }))
    })
    return { weekDate, events: positioned }
  })
  const weekRange = `${weekDayFormatter.format(new Date(`${weekDates[0]}T12:00:00+07:00`))} – ${weekDayFormatter.format(new Date(`${weekDates[6]}T12:00:00+07:00`))}`

  return (
    <section className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low" aria-label="Weekly showtime calendar">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div><h2 className="font-heading text-lg font-bold">{cinema.branchName}</h2><p className="text-xs text-on-surface-variant">{weekRange} · Times shown in Asia/Ho_Chi_Minh</p></div>
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">{showtimes.length} sessions</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-white/5 px-4 py-2.5">{[...roomColors.entries()].map(([roomId, color]) => {
        const room = showtimes.find((showtime) => showtime.room.id === roomId)?.room
        return <span key={roomId} className="inline-flex items-center gap-2 text-[11px] text-on-surface-variant"><span className="size-2.5 rounded-sm" style={{ backgroundColor: color.border }} />{room?.roomName ?? 'Auditorium'}</span>
      })}</div>
      <div className="overflow-x-auto">
        <div className="min-w-[1050px]">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-white/10 bg-surface-container/70">
            <div className="border-r border-white/5" />
            {weekDates.map((weekDate) => <div key={weekDate} className={`border-r border-white/5 px-2 py-3 text-center text-xs font-bold ${weekDate === getTodayInVietnam() ? 'text-primary' : 'text-on-surface-variant'}`}>{weekDayFormatter.format(new Date(`${weekDate}T12:00:00+07:00`))}</div>)}
          </div>
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
            <div className="relative h-[1152px] border-r border-white/10">
              {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-on-surface-variant" style={{ top: `${hour * 48}px` }}>{String(hour).padStart(2, '0')}:00</div>)}
            </div>
            {dayEvents.map(({ weekDate, events }) => <div key={weekDate} className="relative h-[1152px] border-r border-white/5">
              {Array.from({ length: 25 }, (_, hour) => <div key={hour} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${hour * 48}px` }} />)}
              {events.map(({ showtime, startMinutes, endMinutes, lane, laneCount, color, overflow }) => {
                const top = startMinutes / 60 * 48
                const height = Math.max(26, (endMinutes - startMinutes) / 60 * 48 - 3)
                const width = 100 / laneCount
                const starts = timeFormatter.format(new Date(showtime.startAt))
                const ends = timeFormatter.format(new Date(showtime.endAt))
                if (lane >= 2) {
                  const firstOverflow = overflow[0]?.showtime.id === showtime.id
                  if (!firstOverflow) return null
                  return <button key={`more-${showtime.id}`} type="button" onClick={() => onMore(overflow.map((item) => item.showtime))} className="absolute z-[2] overflow-hidden rounded-md border border-white/20 bg-surface-container-high px-1 text-left text-[10px] font-bold text-on-surface shadow" style={{ top, height, left: '66.666%', width: 'calc(33.333% - 4px)' }}>+{overflow.length} more</button>
                }
                return <button key={showtime.id} type="button" onClick={() => onDetails(showtime)} aria-label={`View details for ${showtime.movie.title} showtime in ${showtime.room.roomName}`} className="absolute z-[1] flex cursor-pointer flex-col items-start justify-start overflow-hidden rounded-md border-l-[3px] p-1.5 text-left shadow-sm" style={{ top, height, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)`, backgroundColor: color.background, borderLeftColor: color.border }}>
                  <span className="block truncate text-[11px] font-bold leading-4 text-on-surface">{showtime.movie.title}</span><span className="block truncate text-[10px] text-on-surface-variant">{starts}–{ends}</span><span className="mt-1"><StatusPill status={showtime.displayStatus} /></span>
                </button>
              })}
            </div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function makeLocalDateTime(date, time) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}:00+07:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

function StatusPill({ status }) {
  const classNames = {
    UPCOMING: 'bg-emerald-500/10 text-emerald-300',
    NOW_SHOWING: 'bg-primary-container/15 text-primary',
    ENDED: 'bg-surface-container-high text-on-surface-variant',
    CANCELLED: 'bg-error/10 text-error',
    DRAFT: 'bg-secondary/10 text-secondary',
  }
  const className = classNames[status] ?? 'bg-surface-container-high text-on-surface-variant'
  const label = status.replaceAll('_', ' ')
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}>{label}</span>
}

function ShowtimeDetailsDialog({ showtime, onClose, onEdit, onCancel }) {
  const movie = showtime.movie
  const movieDate = movie.releaseDate ? sessionDateFormatter.format(new Date(movie.releaseDate)) : '—'
  const showtimeDate = sessionDateFormatter.format(new Date(showtime.startAt))
  const detailRows = [
    ['Branch', showtime.cinema.branchName],
    ['Auditorium', showtime.room.roomName],
    ['Room format', showtime.room.roomType || 'Standard'],
    ['Seat capacity', showtime.room.capacity ? `${showtime.room.capacity} seats` : '—'],
    ['Seat map version', showtime.roomLayoutVersion ? `Version ${showtime.roomLayoutVersion}` : '—'],
    ['Release date', movieDate],
    ['Language', movie.language || '—'],
    ['Director', movie.director || '—'],
    ['Cast', movie.cast?.join(', ') || '—'],
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="showtime-details-title" className="my-auto max-h-[min(90vh,900px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-surface-container-low shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/5 bg-surface-container-low/95 p-5 backdrop-blur sm:p-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Showtime details</p><h2 id="showtime-details-title" className="mt-1 font-heading text-xl font-bold sm:text-2xl">{movie.title}</h2><p className="mt-1 text-xs text-on-surface-variant">ID: {showtime.id}</p></div>
          <button type="button" onClick={onClose} aria-label="Close showtime details" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white"><X className="size-4" /></button>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-6">
          {movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} className="mx-auto aspect-[2/3] w-36 rounded-xl object-cover shadow-xl sm:w-full" /> : <div className="mx-auto flex aspect-[2/3] w-36 items-center justify-center rounded-xl bg-surface-container-high sm:w-full"><Film className="size-10 text-primary" /></div>}
          <div className="min-w-0 space-y-5">
            <div className="rounded-xl border border-white/5 bg-surface-container p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Lifecycle</p><StatusPill status={showtime.displayStatus} /></div>
              <p className="mt-2 text-sm font-semibold">Stored status: {showtime.status}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Starts</p><p className="mt-1 text-sm font-semibold">{showtimeDate} · {timeFormatter.format(new Date(showtime.startAt))}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Ends (incl. cleanup)</p><p className="mt-1 text-sm font-semibold">{sessionDateFormatter.format(new Date(showtime.endAt))} · {timeFormatter.format(new Date(showtime.endAt))}</p></div>
              </div>
            </div>

            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-base font-bold">Movie information</h3>{movie.ageRating && <span className="rounded bg-error-container px-2 py-1 text-[10px] font-bold text-on-error-container">{movie.ageRating}</span>}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{(movie.genres ?? []).map((genre) => <span key={genre} className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">{genre}</span>)}</div>
              {movie.synopsis && <p className="mt-3 text-sm leading-6 text-on-surface-variant">{movie.synopsis}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{detailRows.map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p><p className="mt-1 break-words text-sm text-on-surface">{value}</p></div>)}</div>
            </div>
          </div>
        </div>
        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-white/5 bg-surface-container-low/95 p-4 backdrop-blur sm:px-6">
          {showtime.displayStatus === 'UPCOMING' && <><button type="button" onClick={() => onEdit(showtime)} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold hover:bg-surface-bright"><Pencil className="size-4" />Edit Showtime</button><button type="button" onClick={() => onCancel(showtime)} className="inline-flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-2.5 text-sm font-bold text-error hover:bg-error/20"><Ban className="size-4" />Cancel Showtime</button></>}
          <button type="button" onClick={onClose} className="rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-white">Close</button>
        </footer>
      </section>
    </div>
  )
}

function ScheduleForm({ date, movies, rooms, showtime, onClose, onSaved }) {
  const [movieId, setMovieId] = useState(showtime?.movieId ?? '')
  const [roomId, setRoomId] = useState(showtime?.roomId ?? '')
  const [sessionDate, setSessionDate] = useState(showtime ? vietnamDateFormatter.format(new Date(showtime.startAt)) : date)
  const [startTime, setStartTime] = useState(showtime ? timeFormatter.format(new Date(showtime.startAt)) : '18:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const movie = movies.find((item) => item.id === movieId) ?? showtime?.movie
  const room = rooms.find((item) => item.id === roomId) ?? (showtime ? {
    roomName: showtime.room.roomName,
    roomType: showtime.room.roomType,
    capacity: showtime.room.capacity,
    layoutVersion: showtime.roomLayoutVersion,
    branch: showtime.cinema,
  } : undefined)
  const startAt = makeLocalDateTime(sessionDate, startTime)
  const endAt = movie && startAt
    ? new Date(startAt.getTime() + (movie.duration + 15) * 60_000)
    : null
  const startsInFuture = startAt && startAt > new Date()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if ((!showtime && (!movie || !room)) || !startAt || !startsInFuture) {
      setError('Choose a movie, an active room with a seat map, and a future start time.')
      return
    }

    setSaving(true)
    try {
      if (showtime) {
        await rescheduleManagerShowtime(showtime.id, { startAt: startAt.toISOString() })
        toast.success('Showtime schedule updated.')
      } else {
        await createManagerShowtime({ movieId, roomId, startAt: startAt.toISOString() })
        toast.success('Showtime published and seats are ready for booking.')
      }
      onSaved(sessionDate)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="create-showtime-title" className="my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-surface-container-low p-5 shadow-2xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Schedule &amp; programming</p><h2 id="create-showtime-title" className="mt-1 font-heading text-2xl font-bold">{showtime ? 'Modify Showtime' : 'Create Showtime'}</h2><p className="mt-1 text-sm text-on-surface-variant">{showtime ? 'Reschedule this session. Movie and auditorium are fixed after publication.' : 'A published session will become available for booking.'}</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close form" className="grid size-9 place-items-center rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white disabled:opacity-50"><X className="size-4" /></button>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">Movie
            <select required value={movieId} disabled={Boolean(showtime)} onChange={(event) => setMovieId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container disabled:opacity-70">
              <option value="">Select a published movie</option>
              {movies.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.duration} min</option>)}
            </select>
          </label>

          <label className="block text-sm font-semibold">Auditorium
            <select required value={roomId} disabled={Boolean(showtime)} onChange={(event) => setRoomId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container disabled:opacity-70">
              <option value="">Select an active room with a seat map</option>
              {rooms.map((item) => <option key={item.id} value={item.id}>{item.branch.branchName} · {item.roomName} · {item.roomType || 'Standard'}</option>)}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Session date
              <input required type="date" min={getTodayInVietnam()} value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container" />
            </label>
            <label className="block text-sm font-semibold">Start time (Vietnam time)
              <input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container" />
            </label>
          </div>

          <div className="grid gap-3 rounded-xl border border-white/5 bg-surface-container p-4 sm:grid-cols-3">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Format</p><p className="mt-1 text-sm font-semibold">{room?.roomType || 'From selected room'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Estimated end</p><p className="mt-1 text-sm font-semibold">{endAt ? timeFormatter.format(endAt) : '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Room layout</p><p className="mt-1 text-sm font-semibold">{room ? `Version ${room.layoutVersion} · ${room.capacity} seats` : '—'}</p></div>
          </div>
          <p className="text-xs leading-5 text-on-surface-variant">End time includes the movie runtime and a 15-minute cleaning buffer. The room’s configured format and seat layout version are used for this session.</p>

          {error && <p role="alert" className="rounded-lg border border-error-container/40 bg-error-container/15 p-3 text-sm text-primary">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-white disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !movies.length || !rooms.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {saving ? 'Saving…' : showtime ? 'Save Changes' : 'Publish Showtime'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ManagerShowtimesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'history' ? 'history' : 'schedule'
  const date = searchParams.get('date') ?? (view === 'history' ? '' : getTodayInVietnam())
  const [page, setPage] = useState(1)
  const [branchId, setBranchId] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingShowtime, setEditingShowtime] = useState(null)
  const [selectedShowtime, setSelectedShowtime] = useState(null)
  const [moreShowtimes, setMoreShowtimes] = useState(null)
  const [cancellingShowtime, setCancellingShowtime] = useState(null)
  const [query, setQuery] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const { data, loading, error } = useManagerSchedule({ date, view, cinemaId: branchId, query, page }, refreshToken)

  const movies = data?.movies ?? []
  const rooms = useMemo(() => (data?.rooms ?? []).filter((room) =>
    ['ACTIVE', 'AVAILABLE'].includes(room.status) &&
    room.branch.status === 'ACTIVE' && room.hasLayout && room.layoutVersion > 0,
  ), [data?.rooms])
  const branches = useMemo(() => {
    const unique = new Map()
    for (const room of data?.rooms ?? []) unique.set(room.branch.id, room.branch)
    return [...unique.values()].sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [data?.rooms])
  const showtimes = data?.showtimes ?? []
  const calendarGroups = useMemo(() => {
    const branchById = new Map(branches.map((branch) => [branch.id, branch]))
    if (branchId) {
      const branch = branchById.get(branchId) ?? showtimes.find((showtime) => showtime.cinema.id === branchId)?.cinema
      return branch ? [{ cinema: branch, showtimes }] : []
    }
    const grouped = new Map()
    for (const showtime of showtimes) {
      const cinema = branchById.get(showtime.cinema.id) ?? showtime.cinema
      if (!grouped.has(cinema.id)) grouped.set(cinema.id, { cinema, showtimes: [] })
      grouped.get(cinema.id).showtimes.push(showtime)
    }
    return [...grouped.values()].sort((a, b) => a.cinema.branchName.localeCompare(b.cinema.branchName))
  }, [branches, branchId, showtimes])
  const totalPages = data?.meta?.totalPages ?? 0
  const weekDates = getWeekDates(date || getTodayInVietnam())
  const activeRooms = branchId ? rooms.filter((room) => room.branch.id === branchId) : rooms
  const totalCapacity = activeRooms.reduce((sum, room) => sum + room.capacity, 0)

  const onSaved = (savedDate) => {
    setSearchParams({ date: savedDate })
    setPage(1)
    setShowCreateForm(false)
    setEditingShowtime(null)
    setRefreshToken((value) => value + 1)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-xs text-on-surface-variant"><span>Manager Portal</span><span aria-hidden="true">/</span><span className="text-primary">Showtime Management</span></div><h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Showtime Management</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Schedule upcoming sessions or review past and cancelled showtimes.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold hover:bg-surface-bright disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            {view === 'schedule' && <button type="button" onClick={() => setShowCreateForm(true)} disabled={!movies.length || !rooms.length} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Create Showtime</button>}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Schedule summary">
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><CalendarClock className="size-4 text-primary" /><span className="text-xs font-semibold">{view === 'history' ? 'Historical sessions' : 'Sessions this week'}</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : (data?.meta?.total ?? 0).toLocaleString('en-US')}</p></div>
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><Armchair className="size-4 text-secondary" /><span className="text-xs font-semibold">Active auditoriums</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : activeRooms.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><Film className="size-4 text-secondary" /><span className="text-xs font-semibold">Seat capacity</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : totalCapacity.toLocaleString('en-US')}</p></div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-white/5 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{view === 'history' ? 'History date filter' : 'Schedule week'}</p><p className="mt-1 font-heading text-lg font-bold">{view === 'history' ? (date ? dateLabelFormatter.format(new Date(`${date}T12:00:00+07:00`)) : 'All dates') : `${weekDayFormatter.format(new Date(`${weekDates[0]}T12:00:00+07:00`))} – ${weekDayFormatter.format(new Date(`${weekDates[6]}T12:00:00+07:00`))}`}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {view === 'schedule' && <div className="flex items-center gap-1"><button type="button" aria-label="Previous week" onClick={() => { setSearchParams((current) => { const next = new URLSearchParams(current); next.set('date', shiftDate(date || getTodayInVietnam(), -7)); return next }) }} className="grid size-10 place-items-center rounded-lg bg-surface-container-high hover:bg-surface-bright"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => { setSearchParams((current) => { const next = new URLSearchParams(current); next.set('date', getTodayInVietnam()); return next }) }} className="h-10 rounded-lg bg-surface-container-high px-3 text-xs font-semibold hover:bg-surface-bright">Today</button><button type="button" aria-label="Next week" onClick={() => { setSearchParams((current) => { const next = new URLSearchParams(current); next.set('date', shiftDate(date || getTodayInVietnam(), 7)); return next }) }} className="grid size-10 place-items-center rounded-lg bg-surface-container-high hover:bg-surface-bright"><ChevronRight className="size-4" /></button></div>}
            <label className="sr-only" htmlFor="manager-showtime-date">{view === 'history' ? 'Filter history by date' : 'Select schedule date'}</label><input id="manager-showtime-date" type="date" value={date} onChange={(event) => { setSearchParams((current) => { const next = new URLSearchParams(current); if (event.target.value) next.set('date', event.target.value); else next.delete('date'); return next }); setPage(1) }} className="h-10 rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container" />
            <label className="sr-only" htmlFor="manager-showtime-branch">Filter by cinema</label><select id="manager-showtime-branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className="h-10 min-w-48 rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container"><option value="">All cinemas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select>
            <label className="relative"><span className="sr-only">Search showtimes</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Filter showtime or movie title..." className="h-10 w-full rounded-lg border border-white/10 bg-surface-container-high pl-9 pr-3 text-sm text-on-surface outline-none focus:border-primary-container sm:w-64" /></label>
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-xl border border-error-container/40 bg-error-container/15 p-5"><p className="font-semibold text-on-surface">Could not load the schedule</p><p className="mt-1 text-sm text-on-surface-variant">{error}</p><button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-3 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold hover:bg-surface-bright">Try again</button></div>
        ) : loading ? (
          <div aria-label="Loading showtime schedule" className="grid gap-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-surface-container-low" />)}</div>
        ) : view === 'schedule' ? (
          calendarGroups.length ? <div className="space-y-5">{calendarGroups.map(({ cinema, showtimes: cinemaShowtimes }) => <ShowtimeWeekCalendar key={cinema.id} date={date || getTodayInVietnam()} cinema={cinema} showtimes={cinemaShowtimes} onDetails={setSelectedShowtime} onMore={setMoreShowtimes} />)}</div> : (
            <div className="rounded-xl border border-dashed border-white/10 bg-surface-container-low px-5 py-14 text-center"><CalendarDays className="mx-auto size-8 text-on-surface-variant" /><h2 className="mt-3 font-heading text-lg font-bold">No published sessions for this week</h2><p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">Choose another week or branch, or create a session for an active room with a seat map.</p>{view === 'schedule' && <button type="button" onClick={() => setShowCreateForm(true)} disabled={!movies.length || !rooms.length} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson disabled:opacity-50"><Plus className="size-4" />Create Showtime</button>}</div>
          )
        ) : showtimes.length ? (
          <section className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low" aria-label="Scheduled showtimes">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3"><div><h2 className="font-heading text-lg font-bold">{view === 'history' ? 'Showtime History' : 'Upcoming Sessions'}</h2><p className="text-xs text-on-surface-variant">Times shown in Asia/Ho_Chi_Minh</p></div><span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">{(data?.meta?.total ?? showtimes.length).toLocaleString('en-US')} sessions</span></div>
            <div className="divide-y divide-white/5">
              {showtimes.map((showtime) => <article key={showtime.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-surface-container/60 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div><p className="text-xs font-semibold text-on-surface-variant">{sessionDateFormatter.format(new Date(showtime.startAt))}</p><p className="mt-1 font-heading text-xl font-bold text-primary">{timeFormatter.format(new Date(showtime.startAt))}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-on-surface-variant"><Clock3 className="size-3" />Ends {timeFormatter.format(new Date(showtime.endAt))}</p></div>
                <div className="min-w-0"><h3 className="truncate font-semibold">{showtime.movie.title}</h3><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant"><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{showtime.cinema.branchName}</span><span className="inline-flex items-center gap-1"><Armchair className="size-3" />{showtime.room.roomName}</span><span>{showtime.room.roomType || 'Standard'}</span></div></div>
                <div className="flex items-center justify-between gap-3 sm:justify-end"><StatusPill status={showtime.displayStatus} /><div className="flex gap-2"><button type="button" onClick={() => setSelectedShowtime(showtime)} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold hover:bg-surface-bright" aria-label={`View details for ${showtime.movie.title} showtime`}><Eye className="size-3.5" /><span className="hidden md:inline">Details</span></button>{showtime.displayStatus === 'UPCOMING' && <><button type="button" onClick={() => setEditingShowtime(showtime)} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold hover:bg-surface-bright" aria-label={`Edit ${showtime.movie.title} showtime`}><Pencil className="size-3.5" /><span className="hidden md:inline">Edit</span></button><button type="button" onClick={() => setCancellingShowtime(showtime)} className="inline-flex items-center gap-1.5 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs font-bold text-error hover:bg-error/20" aria-label={`Cancel ${showtime.movie.title} showtime`}><Ban className="size-3.5" /><span className="hidden md:inline">Cancel</span></button></>}</div></div>
              </article>)}
            </div>
            {totalPages > 1 && <div className="flex items-center justify-between border-t border-white/5 px-4 py-3"><span className="text-xs text-on-surface-variant">Page {data.meta.page} of {totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-semibold disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-semibold disabled:opacity-40">Next<ChevronRight className="size-4" /></button></div></div>}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-surface-container-low px-5 py-14 text-center"><CalendarDays className="mx-auto size-8 text-on-surface-variant" /><h2 className="mt-3 font-heading text-lg font-bold">{view === 'history' ? 'No historical showtimes found' : 'No published sessions for this date'}</h2><p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">{view === 'history' ? 'Try another date or clear the branch and search filters.' : 'Choose another date or create a session. Only active rooms with a configured seat map can be scheduled.'}</p>{view === 'schedule' && <button type="button" onClick={() => setShowCreateForm(true)} disabled={!movies.length || !rooms.length} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson disabled:opacity-50"><Plus className="size-4" />Create Showtime</button>}</div>
        )}

        {!loading && !error && (!movies.length || !rooms.length) && <p className="flex items-start gap-2 rounded-lg border border-secondary/20 bg-secondary/5 p-3 text-xs leading-5 text-on-surface-variant"><Film className="mt-0.5 size-4 shrink-0 text-secondary" />{!movies.length ? 'Publish at least one movie before scheduling a session.' : 'Create a seat map for an active room before scheduling a session.'}</p>}
      </div>

      {(showCreateForm || editingShowtime) && <ScheduleForm date={date} movies={movies} rooms={rooms} showtime={editingShowtime} onClose={() => { setShowCreateForm(false); setEditingShowtime(null) }} onSaved={onSaved} />}
      {selectedShowtime && <ShowtimeDetailsDialog showtime={selectedShowtime} onClose={() => setSelectedShowtime(null)} onEdit={(showtime) => { setSelectedShowtime(null); setEditingShowtime(showtime) }} onCancel={(showtime) => { setSelectedShowtime(null); setCancellingShowtime(showtime) }} />}
      {moreShowtimes && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreShowtimes(null) }}><section role="dialog" aria-modal="true" aria-labelledby="more-showtimes-title" className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-surface-container-low p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Overlapping sessions</p><h2 id="more-showtimes-title" className="mt-1 font-heading text-xl font-bold">{moreShowtimes.length} more showtimes</h2></div><button type="button" onClick={() => setMoreShowtimes(null)} aria-label="Close overlapping showtimes" className="grid size-9 place-items-center rounded-lg bg-surface-container-high"><X className="size-4" /></button></div><div className="mt-4 space-y-2">{moreShowtimes.map((showtime) => <button key={showtime.id} type="button" onClick={() => { setMoreShowtimes(null); setSelectedShowtime(showtime) }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-surface-container p-3 text-left hover:bg-surface-container-high"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{showtime.movie.title}</span><span className="mt-1 block text-xs text-on-surface-variant">{showtime.room.roomName} · {showtime.cinema.branchName}</span></span><span className="shrink-0 text-xs font-bold text-primary">{timeFormatter.format(new Date(showtime.startAt))}–{timeFormatter.format(new Date(showtime.endAt))}</span></button>)}</div></section></div>}
      {cancellingShowtime && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" aria-labelledby="cancel-showtime-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-container-low p-6 shadow-2xl"><h2 id="cancel-showtime-title" className="font-heading text-xl font-bold">Cancel Showtime?</h2><p className="mt-2 text-sm leading-6 text-on-surface-variant">Cancel <strong className="text-on-surface">{cancellingShowtime.movie.title}</strong> at {timeFormatter.format(new Date(cancellingShowtime.startAt))} in {cancellingShowtime.room.roomName}? This keeps the record for history. Sessions with active holds or bookings cannot be cancelled here.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={cancelling} onClick={() => setCancellingShowtime(null)} className="rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold">Keep Showtime</button><button type="button" disabled={cancelling} onClick={async () => { setCancelling(true); try { await cancelManagerShowtime(cancellingShowtime.id); toast.success('Showtime cancelled.'); setCancellingShowtime(null); setRefreshToken((value) => value + 1) } catch (requestError) { toast.error(getApiErrorMessage(requestError)) } finally { setCancelling(false) } }} className="rounded-lg bg-error px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Confirm Cancellation'}</button></div></section></div>}
    </div>
  )
}

export default ManagerShowtimesPage
