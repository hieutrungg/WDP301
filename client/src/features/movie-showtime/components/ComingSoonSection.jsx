import { ArrowRight, Bell, CalendarClock, Play } from 'lucide-react'

function ComingSoonSection({ movies }) {
  return (
    <section id="showtimes" className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-1 text-secondary"><CalendarClock className="size-5" /><span className="text-[11px] font-bold uppercase tracking-wider">Upcoming Releases</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Coming Soon to F-Cinema</h2>
            <span className="rounded-full bg-secondary-container px-2 py-1 text-[10px] font-bold text-on-secondary-container">SUMMER 2024</span>
          </div>
        </div>
        <a href="#" className="hidden items-center gap-1 text-sm font-semibold text-on-surface-variant sm:flex">View Full Schedule <ArrowRight className="size-4" /></a>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {movies.map((movie) => (
          <article key={movie.id} className="group flex flex-col overflow-hidden rounded-xl border border-white/5 bg-surface-container shadow-xl">
            <div className="relative aspect-[16/10] overflow-hidden bg-surface-container-high">
              <img src={movie.image} alt={`${movie.title} promotional artwork`} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/20 to-transparent" />
              <span className="absolute left-3 top-3 rounded bg-primary-container px-2 py-1 text-[10px] font-bold text-white shadow-md">{movie.releaseDate}</span>
              <span className="absolute right-3 top-3 rounded bg-surface-container-lowest/80 px-2 py-1 text-[10px] font-bold uppercase text-on-surface backdrop-blur-md">{movie.studio}</span>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-4 p-4">
              <div><h3 className="font-heading text-lg font-semibold text-on-surface transition-colors group-hover:text-primary">{movie.title}</h3><p className="mt-1 text-xs text-on-surface-variant">{movie.genres}</p></div>
              <div className="flex gap-2">
                <button type="button" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container-highest"><Bell className="size-4 text-secondary" />Remind Me</button>
                <button type="button" aria-label={`Play ${movie.title} trailer`} className="grid size-9 place-items-center rounded-lg bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"><Play className="size-4" /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ComingSoonSection
