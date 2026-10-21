import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2, Film, LoaderCircle, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { getMovieForManagement, updateMovie } from '../api/managerMovieApi'
import MovieFormFields from '../components/MovieFormFields'
import { buildMoviePatch, initialMovieForm, movieFieldErrors, movieRequestError, movieToForm, validateMovieForm } from '../utils/movieForm'

const catalogRoute = '/manager/movies'

function formatModified(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export default function UpdateMoviePage() {
  const { movieId } = useParams()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState({ key: '', movie: null, error: null })
  const [form, setForm] = useState(initialMovieForm)
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const submitting = useRef(false)
  const saveController = useRef(null)
  const loadKey = `${movieId}:${attempt}`
  const loading = loaded.key !== loadKey
  const movie = !loading && loaded.movie
  const patch = movie ? buildMoviePatch(form, movie) : {}
  const dirty = Object.keys(patch).length > 0
  const saveUnavailable = ['unauthenticated', 'forbidden', 'notfound'].includes(saveError?.kind)

  useEffect(() => {
    const controller = new AbortController()
    getMovieForManagement(movieId, { signal: controller.signal })
      .then((currentMovie) => {
        if (controller.signal.aborted) return
        setLoaded({ key: loadKey, movie: currentMovie, error: null })
        setForm(movieToForm(currentMovie))
        setErrors({})
        setSaveError(null)
        setSaved(null)
        setSaving(false)
        setPosterFailed(false)
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoaded({ key: loadKey, movie: null, error: movieRequestError(failure) })
      })
    return () => {
      controller.abort()
      saveController.current?.abort()
    }
  }, [movieId, loadKey])

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setSaved(null)
    if (name === 'posterUrl') setPosterFailed(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current || !movie || !dirty || saveUnavailable) return
    const nextErrors = validateMovieForm(form, { includeDuration: movie.canEditDuration === true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    submitting.current = true
    const controller = new AbortController()
    saveController.current = controller
    setSaving(true)
    setSaveError(null)
    setSaved(null)
    try {
      const updatedMovie = await updateMovie(movieId, patch, { signal: controller.signal })
      if (controller.signal.aborted) return
      setLoaded({ key: loadKey, movie: updatedMovie, error: null })
      setForm(movieToForm(updatedMovie))
      setSaved(updatedMovie)
      setPosterFailed(false)
      toast.success('Movie updated successfully')
    } catch (failure) {
      if (controller.signal.aborted) return
      setErrors(movieFieldErrors(failure))
      setSaveError(movieRequestError(failure))
    } finally {
      submitting.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <Link to={catalogRoute} className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary"><ArrowLeft className="size-4" />Movie Management</Link>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Movie catalog & distribution</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Update Movie</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Edit movie details and save changes to your cinema catalog.</p></div>
      <Film className="size-10 text-primary" />
    </div>
    {loading && <div role="status" className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-surface-container-low p-8 text-on-surface-variant"><LoaderCircle className="size-5 animate-spin" />Loading movie details…</div>}
    {!loading && loaded.error && <div role="alert" className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-amber-200">
      <h2 className="text-lg font-bold">{loaded.error.title}</h2>
      <p className="text-sm">{loaded.error.message}</p>
      {['error', 'unauthenticated', 'forbidden'].includes(loaded.error.kind) && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 px-4 py-2 text-sm font-bold"><RefreshCw className="size-4" />Try again</button>}
    </div>}
    {movie && <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface-container-low px-5 py-4 text-xs text-on-surface-variant">
        <div className="flex min-w-0 flex-wrap items-center gap-3"><span className="break-all">Movie ID: {movie.id}</span><span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-bold text-primary">{movie.status}</span></div>
        <span>Last modified: <time dateTime={movie.updatedAt}>{formatModified(movie.updatedAt)}</time> (Vietnam time)</span>
      </div>
      {saveError && <div role="alert" className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200"><p className="font-bold">{saveError.title}</p><p className="text-sm">{saveError.message}</p><p className="text-sm">Your unsaved changes have been kept on this page.</p></div>}
      {saved && <div role="status" className="flex gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200"><CheckCircle2 className="size-5 shrink-0" /><div><p className="font-bold">{saved.title} updated successfully</p><p className="mt-1 text-sm">Your changes have been saved.</p></div></div>}
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving || saveUnavailable} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <MovieFormFields form={form} errors={errors} onChange={change} disabled={saving || saveUnavailable}
            editing canEditDuration={movie.canEditDuration === true} posterFailed={posterFailed} onPosterError={() => setPosterFailed(true)}
            onGenresChange={(genres) => {
              setForm((current) => ({ ...current, genres }))
              setErrors((current) => ({ ...current, genres: undefined }))
              setSaved(null)
            }} />
        </fieldset>
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
          <Link to={catalogRoute} aria-disabled={saving} className={`rounded-lg border border-white/10 px-5 py-3 text-sm font-bold ${saving ? 'pointer-events-none opacity-50' : ''}`}>Cancel</Link>
          <button type="submit" disabled={saving || !dirty || saveUnavailable} className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson disabled:opacity-50">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>}
  </section>
}
