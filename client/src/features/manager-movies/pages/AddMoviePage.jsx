import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Film, ImagePlus, LoaderCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { createMovie } from '../api/managerMovieApi'
import GenreMultiSelect from '../components/GenreMultiSelect'
import { MOVIE_AGE_RATINGS } from '../data/ageRatings'

const initialForm = {
  title: '', releaseDate: '', duration: '', genres: [], ageRating: '', language: '',
  director: '', cast: '', trailerUrl: '', synopsis: '', posterUrl: '',
}
const inputClass = 'mt-2 w-full rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60'

function Field({ name, label, errors, children }) {
  return <div><label htmlFor={name} className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</label>{children}
    {errors[name] && <p id={`${name}-error`} className="mt-1 text-sm text-red-400" role="alert">{errors[name]}</p>}
  </div>
}

export default function AddMoviePage() {
  const [form, setForm] = useState(initialForm)
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
    const split = (value) => value.split(',').map((item) => item.trim()).filter(Boolean)
    const nextErrors = {}
    for (const name of ['title', 'releaseDate', 'language', 'director', 'ageRating', 'synopsis', 'posterUrl']) {
      if (!form[name].trim()) nextErrors[name] = 'This field is required'
    }
    if (!form.genres.length) nextErrors.genres = 'Add at least one genre'
    if (!Number.isInteger(Number(form.duration)) || Number(form.duration) <= 0) nextErrors.duration = 'Enter a whole number greater than zero'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    submitting.current = true
    setSaving(true)
    setError('')
    setSaved(null)
    try {
      const movie = await createMovie({
        ...Object.fromEntries(Object.entries(form).filter(([key]) => key !== 'genres').map(([key, value]) => [key, value.trim()])),
        duration: Number(form.duration), genres: form.genres, cast: split(form.cast), status,
      })
      setSaved(movie)
      setForm(initialForm)
      setPosterFailed(false)
      toast.success('Movie saved successfully')
    } catch (failure) {
      const body = failure.response?.data
      setErrors(Object.fromEntries((body?.errors || []).map(({ field, message }) => [field.split('.')[0], message])))
      setError(body?.message || 'Unable to save movie. Please try again.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  function input(name, label, options = {}) {
    return <Field name={name} label={label} errors={errors} key={name}>
      <input id={name} name={name} value={form[name]} onChange={change} className={inputClass}
        aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} {...options} />
    </Field>
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
        <div className="space-y-6 rounded-2xl border border-white/10 bg-surface-container-low p-5 sm:p-7">
          <h2 className="text-lg font-bold">Movie information</h2>
          {input('title', 'Official theatrical title *', { required: true })}
          <div className="grid gap-5 sm:grid-cols-2">
            {input('releaseDate', 'Release date *', { type: 'date', required: true })}
            {input('duration', 'Duration (minutes) *', { type: 'number', min: 1, step: 1, required: true })}
            <Field name="genres" label="Film genres *" errors={errors}>
              <GenreMultiSelect value={form.genres} disabled={saving} invalid={!!errors.genres}
                describedBy={errors.genres ? 'genres-error' : undefined}
                onChange={(genres) => {
                  setForm((current) => ({ ...current, genres }))
                  setSaved(null)
                  setErrors((current) => ({ ...current, genres: undefined }))
                }} />
            </Field>
            <Field name="ageRating" label="Age rating *" errors={errors}>
              <select id="ageRating" name="ageRating" value={form.ageRating} onChange={change}
                required className={`${inputClass} [color-scheme:dark]`}
                aria-invalid={!!errors.ageRating}
                aria-describedby={errors.ageRating ? 'ageRating-error' : undefined}>
                <option value="" disabled>Select age rating…</option>
                {MOVIE_AGE_RATINGS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
              </select>
            </Field>
          </div>
          {input('language', 'Language *', { required: true, placeholder: 'e.g. Vietnamese' })}
          {input('director', 'Director *', { required: true })}
          {input('cast', 'Cast', { placeholder: 'Separate cast members with commas' })}
          {input('trailerUrl', 'Trailer URL', { type: 'url', pattern: 'https?://.*', placeholder: 'https://' })}
          <Field name="synopsis" label="Synopsis *" errors={errors}>
            <textarea id="synopsis" name="synopsis" value={form.synopsis} onChange={change} required rows={6}
              aria-invalid={!!errors.synopsis} aria-describedby={errors.synopsis ? 'synopsis-error' : undefined} className={inputClass} />
          </Field>
        </div>
        <aside className="space-y-5 self-start rounded-2xl border border-white/10 bg-surface-container-low p-5 sm:p-7">
          <h2 className="text-lg font-bold">Poster & preview</h2>
          {input('posterUrl', 'Poster URL *', { type: 'url', pattern: 'https?://.*', required: true, placeholder: 'https://…/poster.jpg' })}
          <div className="mx-auto flex aspect-[2/3] w-full max-w-72 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-surface-container-lowest">
            {form.posterUrl && /^https?:\/\//i.test(form.posterUrl) && !posterFailed
              ? <img src={form.posterUrl} alt={form.title ? `${form.title} poster preview` : 'Poster preview'} className="h-full w-full object-cover" onError={() => setPosterFailed(true)} />
              : <div className="p-6 text-center text-on-surface-variant"><ImagePlus className="mx-auto mb-3 size-10" /><p className="text-sm">{posterFailed ? 'Unable to load this poster. Check the image URL.' : 'Add a poster URL to see the preview.'}</p></div>}
          </div>
          <p className="text-xs leading-5 text-on-surface-variant">Use an image URL accessible to your audience. Cast members are separated by commas.</p>
        </aside>
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
