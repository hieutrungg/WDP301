import { useMemo, useState } from 'react'
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

function getTodayInVietnam() {
  return vietnamDateFormatter.format(new Date())
}

function makeLocalDateTime(date, time) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}:00+07:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

function StatusPill({ status }) {
  const className = status === 'UPCOMING'
    ? 'bg-emerald-500/10 text-emerald-300'
    : 'bg-secondary/10 text-secondary'
  const label = status === 'UPCOMING' ? 'Upcoming' : status.replaceAll('_', ' ')
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}>{label}</span>
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
  const [date, setDate] = useState(getTodayInVietnam)
  const [branchId, setBranchId] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingShowtime, setEditingShowtime] = useState(null)
  const [cancellingShowtime, setCancellingShowtime] = useState(null)
  const [query, setQuery] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const { data, loading, error } = useManagerSchedule(date, refreshToken)
  const movies = data?.movies ?? []
  const rooms = useMemo(() => (data?.rooms ?? []).filter((room) =>
    ['ACTIVE', 'AVAILABLE'].includes(room.status) &&
    room.branch.status === 'ACTIVE' && room.hasLayout && room.layoutVersion > 0,
  ), [data?.rooms])
  const branches = useMemo(() => {
    const unique = new Map()
    for (const room of rooms) unique.set(room.branch.id, room.branch)
    return [...unique.values()].sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [rooms])
  const showtimes = useMemo(() => (data?.showtimes ?? []).filter((showtime) => {
    const matchesBranch = !branchId || showtime.cinemaId === branchId
    const text = `${showtime.movie.title} ${showtime.room.roomName} ${showtime.cinema.branchName}`.toLocaleLowerCase()
    return matchesBranch && text.includes(query.trim().toLocaleLowerCase())
  }), [branchId, data?.showtimes, query])
  const activeRooms = branchId ? rooms.filter((room) => room.branch.id === branchId) : rooms
  const totalCapacity = activeRooms.reduce((sum, room) => sum + room.capacity, 0)

  const onSaved = (savedDate) => {
    setDate(savedDate)
    setShowCreateForm(false)
    setEditingShowtime(null)
    setRefreshToken((value) => value + 1)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-xs text-on-surface-variant"><span>Manager Portal</span><span aria-hidden="true">/</span><span className="text-primary">Showtime Management</span></div><h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Showtime Management</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Schedule published sessions across active cinemas and configured auditoriums.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold hover:bg-surface-bright disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button type="button" onClick={() => setShowCreateForm(true)} disabled={!movies.length || !rooms.length} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Create Showtime</button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Schedule summary">
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><CalendarClock className="size-4 text-primary" /><span className="text-xs font-semibold">Sessions on selected date</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : showtimes.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><Armchair className="size-4 text-secondary" /><span className="text-xs font-semibold">Active auditoriums</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : activeRooms.length}</p></div>
          <div className="rounded-xl border border-white/5 bg-surface-container-low p-4"><div className="flex items-center gap-2 text-on-surface-variant"><Film className="size-4 text-secondary" /><span className="text-xs font-semibold">Seat capacity</span></div><p className="mt-2 font-heading text-3xl font-bold">{loading ? '—' : totalCapacity.toLocaleString('en-US')}</p></div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-white/5 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Schedule date</p><p className="mt-1 font-heading text-lg font-bold">{dateLabelFormatter.format(new Date(`${date}T12:00:00+07:00`))}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="manager-showtime-date">Select schedule date</label><input id="manager-showtime-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container" />
            <label className="sr-only" htmlFor="manager-showtime-branch">Filter by cinema</label><select id="manager-showtime-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-10 min-w-48 rounded-lg border border-white/10 bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary-container"><option value="">All cinemas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select>
            <label className="relative"><span className="sr-only">Search showtimes</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter showtime or movie title..." className="h-10 w-full rounded-lg border border-white/10 bg-surface-container-high pl-9 pr-3 text-sm text-on-surface outline-none focus:border-primary-container sm:w-64" /></label>
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-xl border border-error-container/40 bg-error-container/15 p-5"><p className="font-semibold text-on-surface">Could not load the schedule</p><p className="mt-1 text-sm text-on-surface-variant">{error}</p><button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-3 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold hover:bg-surface-bright">Try again</button></div>
        ) : loading ? (
          <div aria-label="Loading showtime schedule" className="grid gap-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-surface-container-low" />)}</div>
        ) : showtimes.length ? (
          <section className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low" aria-label="Scheduled showtimes">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3"><div><h2 className="font-heading text-lg font-bold">Published Sessions</h2><p className="text-xs text-on-surface-variant">Times shown in Asia/Ho_Chi_Minh</p></div><span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">{showtimes.length} sessions</span></div>
            <div className="divide-y divide-white/5">
              {showtimes.map((showtime) => <article key={showtime.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-surface-container/60 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div><p className="font-heading text-xl font-bold text-primary">{timeFormatter.format(new Date(showtime.startAt))}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-on-surface-variant"><Clock3 className="size-3" />Ends {timeFormatter.format(new Date(showtime.endAt))}</p></div>
                <div className="min-w-0"><h3 className="truncate font-semibold">{showtime.movie.title}</h3><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant"><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{showtime.cinema.branchName}</span><span className="inline-flex items-center gap-1"><Armchair className="size-3" />{showtime.room.roomName}</span><span>{showtime.room.roomType || 'Standard'}</span></div></div>
                <div className="flex items-center justify-between gap-3 sm:justify-end"><StatusPill status={showtime.displayStatus} /><div className="flex gap-2"><button type="button" onClick={() => setEditingShowtime(showtime)} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold hover:bg-surface-bright" aria-label={`Edit ${showtime.movie.title} showtime`}><Pencil className="size-3.5" /><span className="hidden md:inline">Edit</span></button><button type="button" onClick={() => setCancellingShowtime(showtime)} className="inline-flex items-center gap-1.5 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs font-bold text-error hover:bg-error/20" aria-label={`Cancel ${showtime.movie.title} showtime`}><Ban className="size-3.5" /><span className="hidden md:inline">Cancel</span></button></div></div>
              </article>)}
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-surface-container-low px-5 py-14 text-center"><CalendarDays className="mx-auto size-8 text-on-surface-variant" /><h2 className="mt-3 font-heading text-lg font-bold">No published sessions for this date</h2><p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">Choose another date or create a session. Only active rooms with a configured seat map can be scheduled.</p><button type="button" onClick={() => setShowCreateForm(true)} disabled={!movies.length || !rooms.length} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson disabled:opacity-50"><Plus className="size-4" />Create Showtime</button></div>
        )}

        {!loading && !error && (!movies.length || !rooms.length) && <p className="flex items-start gap-2 rounded-lg border border-secondary/20 bg-secondary/5 p-3 text-xs leading-5 text-on-surface-variant"><Film className="mt-0.5 size-4 shrink-0 text-secondary" />{!movies.length ? 'Publish at least one movie before scheduling a session.' : 'Create a seat map for an active room before scheduling a session.'}</p>}
      </div>

      {(showCreateForm || editingShowtime) && <ScheduleForm date={date} movies={movies} rooms={rooms} showtime={editingShowtime} onClose={() => { setShowCreateForm(false); setEditingShowtime(null) }} onSaved={onSaved} />}
      {cancellingShowtime && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" aria-labelledby="cancel-showtime-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-container-low p-6 shadow-2xl"><h2 id="cancel-showtime-title" className="font-heading text-xl font-bold">Cancel Showtime?</h2><p className="mt-2 text-sm leading-6 text-on-surface-variant">Cancel <strong className="text-on-surface">{cancellingShowtime.movie.title}</strong> at {timeFormatter.format(new Date(cancellingShowtime.startAt))} in {cancellingShowtime.room.roomName}? This keeps the record for history. Sessions with active holds or bookings cannot be cancelled here.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={cancelling} onClick={() => setCancellingShowtime(null)} className="rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-semibold">Keep Showtime</button><button type="button" disabled={cancelling} onClick={async () => { setCancelling(true); try { await cancelManagerShowtime(cancellingShowtime.id); toast.success('Showtime cancelled.'); setCancellingShowtime(null); setRefreshToken((value) => value + 1) } catch (requestError) { toast.error(getApiErrorMessage(requestError)) } finally { setCancelling(false) } }} className="rounded-lg bg-error px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Confirm Cancellation'}</button></div></section></div>}
    </div>
  )
}

export default ManagerShowtimesPage
