import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArrowUpRight, Film, Info, LoaderCircle, LockKeyhole, ShieldAlert, TriangleAlert, X } from 'lucide-react'
import { archiveMovie } from '../api/managerMovieApi'

export default function ArchiveMovieModal({ movie, onClose, onArchived }) {
  const dialog = useRef(null)
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [posterFailed, setPosterFailed] = useState(false)
  const blocked = error?.dependencies.length > 0
  const unavailable = blocked || [401, 403, 404].includes(error?.status)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  function close() {
    if (!submitting.current) onClose()
  }

  async function confirm(event) {
    event.preventDefault()
    if (submitting.current || unavailable) return
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      const updated = await archiveMovie(movie.id)
      onArchived(updated)
    } catch (failure) {
      const status = failure.response?.status
      setError({ status, dependencies: failure.response?.data?.errors?.filter(({ field, id }) => field === 'showtimes' && id) ?? [], message: status === 401 ? 'Your session has expired. Sign in again.'
        : status === 403 ? 'You no longer have permission to archive this movie.'
          : status === 404 ? 'Movie not found. Close this dialog and refresh the catalog.'
            : failure.response?.data?.message || 'Unable to archive movie. Please try again.' })
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return <dialog ref={dialog} aria-labelledby="archive-title" aria-describedby="archive-description" onCancel={(event) => { event.preventDefault(); close() }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border border-white/10 border-t-primary/70 bg-surface-container-low p-0 text-on-surface shadow-2xl backdrop:bg-black/85 backdrop:backdrop-blur-sm">
    <form onSubmit={confirm} className="flex max-h-[90dvh] flex-col" aria-busy={saving}>
      <div className="space-y-5 overflow-y-auto p-5 [scrollbar-color:#3a3a40_transparent] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><TriangleAlert className="size-5" /></span>
        <div className="min-w-0 flex-1"><h2 id="archive-title" className="font-display text-xl font-bold">Archive Movie — Confirmation Required</h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">Remove this title from the active movie catalog.</p></div>
        <button type="button" aria-label="Close archive dialog" onClick={close} disabled={saving} className="rounded-md bg-white/5 p-1.5 text-on-surface-variant hover:text-on-surface disabled:opacity-40"><X className="size-4" /></button>
      </div>
      <div className="flex items-start gap-4 rounded-lg border border-white/5 bg-black/25 p-4">
        {movie.posterUrl && !posterFailed
          ? <img src={movie.posterUrl} alt={`Poster for ${movie.title}`} onError={() => setPosterFailed(true)} className="aspect-[2/3] w-20 shrink-0 rounded-md object-cover" />
          : <div role="img" aria-label="Movie poster unavailable" className="flex aspect-[2/3] w-20 shrink-0 items-center justify-center rounded-md bg-white/5"><Film className="size-7 text-on-surface-variant" /></div>}
        <div className="min-w-0 space-y-2">
          <p className="break-all font-mono text-[10px] text-on-surface-variant">ID: {movie.id}</p>
          <h3 className="break-words text-lg font-bold leading-snug">{movie.title}</h3>
          <p className="text-xs text-on-surface-variant">{movie.duration} min · {movie.ageRating} · {movie.releaseDate.slice(0, 4)}</p>
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold tracking-wide ${movie.status === 'PUBLISHED' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/15 bg-white/5 text-on-surface-variant'}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{movie.status}</span>
        </div>
      </div>
      <div className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.025] p-4"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
        <p id="archive-description" className="text-sm leading-relaxed text-on-surface-variant">Archiving this movie will remove it from public movie browsing and prevent it from being selected for new showtime scheduling. Its information and existing history will be preserved.</p>
      </div>
      {error && <div role="alert" className={`space-y-3 rounded-lg border p-4 text-sm ${blocked ? 'border-primary/30 bg-primary/10' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
        {blocked && <div className="flex items-center gap-2 text-primary"><ShieldAlert className="size-5 shrink-0" /><p className="text-[10px] font-bold uppercase tracking-widest">Archive action blocked</p></div>}
        <p className="font-semibold">{error.message}</p>
        {blocked && <><ul className="max-h-36 list-disc space-y-2 overflow-y-auto pl-5 text-xs text-on-surface-variant">{error.dependencies.map(({ id, message }) => <li key={id} className="break-words">{message} · Showtime {id}</li>)}</ul>
          <p className="text-xs leading-relaxed text-on-surface-variant">Resolve these dependencies or wait for the screenings to end. Then close and reopen this dialog to try again.</p>
          <Link to="/manager/showtimes" onClick={onClose} className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline">View Showtimes<ArrowUpRight className="size-3.5" /></Link>
        </>}
      </div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-surface-container-low px-5 py-4 sm:px-6">
        <button autoFocus type="button" onClick={close} disabled={saving} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold disabled:opacity-40">Cancel<span className="ml-2 rounded border border-white/10 px-1 text-[9px] text-on-surface-variant">ESC</span></button>
        <button type="submit" disabled={saving || unavailable} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? <LoaderCircle className="size-4 animate-spin" /> : blocked ? <LockKeyhole className="size-4" /> : <Archive className="size-4" />}{saving ? 'Archiving…' : 'Archive Movie'}</button>
      </div>
    </form>
  </dialog>
}
