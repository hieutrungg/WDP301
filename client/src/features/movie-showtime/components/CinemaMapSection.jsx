import { useEffect, useState } from 'react'
import { ExternalLink, MapPin, Phone, RotateCcw } from 'lucide-react'
import { getPublicCinemas } from '../../../lib/api/publicCinemaApi'

const BRANCH_PAGE_SIZE = 50

async function loadAllCinemas(signal) {
  const firstPage = await getPublicCinemas({ page: 1, limit: BRANCH_PAGE_SIZE }, signal)
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
      getPublicCinemas({ page: index + 2, limit: BRANCH_PAGE_SIZE }, signal),
    ),
  )

  return [firstPage, ...remainingPages].flatMap(({ items }) => items)
}

function getMapSearchUrl(cinema) {
  const query = `${cinema.branchName}, ${cinema.address}`
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

function getGoogleMapsUrl(cinema) {
  const query = `${cinema.branchName}, ${cinema.address}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function CinemaMapSection() {
  const [cinemas, setCinemas] = useState([])
  const [selectedCinemaId, setSelectedCinemaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const selectedCinema = cinemas.find(({ id }) => id === selectedCinemaId) ?? cinemas[0]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)

    loadAllCinemas(controller.signal)
      .then((items) => {
        setCinemas(items)
        setSelectedCinemaId((currentId) => items.some(({ id }) => id === currentId) ? currentId : items[0]?.id ?? '')
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [reloadKey])

  return (
    <section id="cinema-locations" aria-labelledby="cinema-locations-heading" className="my-8 bg-surface-container-lowest py-12 sm:my-10 sm:py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-secondary">Visit F-Cinema</p>
            <h2 id="cinema-locations-heading" className="mt-1 font-heading text-2xl font-bold text-on-surface sm:text-3xl">Find a Cinema Near You</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Explore our active cinema branches and open directions in Google Maps.</p>
          </div>
          {!loading && !error && cinemas.length > 0 && <span className="w-fit rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant">{cinemas.length} {cinemas.length === 1 ? 'location' : 'locations'}</span>}
        </div>

        {loading && (
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]" aria-label="Loading cinema locations">
            <div className="h-[420px] animate-pulse rounded-2xl bg-surface-container" />
            <div className="h-[420px] animate-pulse rounded-2xl bg-surface-container" />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-error-container/60 bg-error-container/10 px-6 py-10 text-center">
            <MapPin className="mx-auto size-9 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-on-surface-variant">We could not load cinema locations right now.</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-on-primary-container">
              <RotateCcw className="size-4" aria-hidden="true" />Try again
            </button>
          </div>
        )}

        {!loading && !error && cinemas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-surface-container px-6 py-12 text-center">
            <MapPin className="mx-auto size-9 text-on-surface-variant" aria-hidden="true" />
            <p className="mt-3 font-semibold text-on-surface">No active cinema locations yet</p>
            <p className="mt-1 text-sm text-on-surface-variant">Active branches will appear here when they are available.</p>
          </div>
        )}

        {!loading && !error && selectedCinema && (
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-surface-container p-3 sm:p-4">
              <h3 className="px-2 pb-3 font-heading text-sm font-bold text-on-surface">Our locations</h3>
              <ul className="space-y-2">
                {cinemas.map((cinema) => {
                  const selected = cinema.id === selectedCinema.id
                  return (
                    <li key={cinema.id}>
                      <button type="button" aria-pressed={selected} onClick={() => setSelectedCinemaId(cinema.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary-container/60 bg-primary-container/10' : 'border-transparent bg-surface-container-low hover:border-white/10 hover:bg-surface-container-high'}`}>
                        <span className="flex items-start gap-2.5">
                          <MapPin className={`mt-0.5 size-4 shrink-0 ${selected ? 'text-primary' : 'text-secondary'}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-on-surface">{cinema.branchName}</span>
                            <span className="mt-1 block text-xs leading-5 text-on-surface-variant">{cinema.address}</span>
                            {cinema.hotline && <span className="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant"><Phone className="size-3" aria-hidden="true" />{cinema.hotline}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-container">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-base font-bold text-on-surface">{selectedCinema.branchName}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">{selectedCinema.address}</p>
                </div>
                <a href={getGoogleMapsUrl(selectedCinema)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-xs font-bold text-on-primary-container transition hover:opacity-90">
                  <ExternalLink className="size-4" aria-hidden="true" />Open Google Maps
                </a>
              </div>
              <iframe
                key={selectedCinema.id}
                title={`Google Maps location for ${selectedCinema.branchName}`}
                src={getMapSearchUrl(selectedCinema)}
                className="h-[320px] w-full border-t border-white/10 sm:h-[400px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default CinemaMapSection
