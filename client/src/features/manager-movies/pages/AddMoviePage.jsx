import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Film, LoaderCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { createMovie } from '../api/managerMovieApi'
import MovieFormFields from '../components/MovieFormFields'
import { buildCreateMovieInput, initialMovieForm, movieFieldErrors, validateMovieForm } from '../utils/movieForm'

export default function AddMoviePage() {
  const [form, setForm] = useState(initialMovieForm)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const submitting = useRef(false)

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setSaved(null)
    setErrors((current) => ({ ...current, [name]: undefined }))
    if (name === 'posterUrl') setPosterFailed(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const status = event.nativeEvent.submitter?.value || 'PUBLISHED'
    const nextErrors = validateMovieForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    submitting.current = true
    setSaving(true)
    setError('')
    setSaved(null)
    try {
      const movie = await createMovie(buildCreateMovieInput(form, status))
      setSaved(movie)
      setForm(initialMovieForm)
      setPosterFailed(false)
      toast.success('Movie saved successfully')
    } catch (failure) {
      const body = failure.response?.data
      setErrors(movieFieldErrors(failure))
      setError(body?.message || 'Unable to save movie. Please try again.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Movie catalog & distribution</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Add New Movie</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Register a film and prepare it for your cinema catalog.</p></div>
      <Film className="size-10 text-primary" />
    </div>
    {error && <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200">{error}</div>}
    {saved && <div role="status" className="flex gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200">
      <CheckCircle2 className="size-5 shrink-0" /><div><p className="font-bold">{saved.title} saved successfully</p>
        <p className="mt-1 text-sm">Status: {saved.status === 'DRAFT' ? 'Draft' : 'Published'}</p>
        {saved.status === 'PUBLISHED' && <Link className="mt-2 inline-block underline" to={`/movies/${saved.id}`}>View movie</Link>}</div>
    </div>}
    <form onSubmit={submit}>
      <fieldset disabled={saving} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MovieFormFields form={form} errors={errors} onChange={change} disabled={saving}
          posterFailed={posterFailed} onPosterError={() => setPosterFailed(true)}
          onGenresChange={(genres) => {
            setForm((current) => ({ ...current, genres }))
            setSaved(null)
            setErrors((current) => ({ ...current, genres: undefined }))
          }} />
        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5 lg:col-span-2">
          <Link to="/manager" className={`rounded-lg border border-white/10 px-5 py-3 text-sm font-bold ${saving ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={saving}>Cancel</Link>
          <button type="submit" value="DRAFT" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold disabled:opacity-50">Save Draft</button>
          <button type="submit" value="PUBLISHED" className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson disabled:opacity-50">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? 'Saving…' : 'Save Movie'}</button>
        </div>
      </fieldset>
    </form>
  </section>
}
