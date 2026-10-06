import { CirclePlay, Clock3, Star, Ticket } from 'lucide-react'

function HeroBanner({ movie }) {
  return (
    <section className="relative flex min-h-[680px] items-end pb-28 pt-28 md:min-h-[720px]">
      <div className="absolute inset-0">
        <img src={movie.backdrop} alt="" className="size-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent md:w-4/5 lg:w-3/5" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/90 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider">
            <span className="rounded bg-error-container px-2 py-1 text-on-error-container">{movie.ageRating}</span>
            {movie.formats.map((format, index) => (
              <span key={format} className={`rounded bg-surface-container-high px-2 py-1 ${index === 0 ? 'text-secondary' : 'text-tertiary-fixed'}`}>{format}</span>
            ))}
            <span className="flex items-center gap-1.5 rounded bg-surface-container-low px-2 py-1 font-normal text-on-surface">
              <span className="size-1.5 animate-pulse rounded-full bg-primary-container" /> NOW SHOWING
            </span>
          </div>
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-secondary sm:text-lg">{movie.eyebrow}</p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">{movie.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:gap-4 sm:text-sm">
            <div className="flex items-center gap-1.5 rounded bg-surface-container-low/80 px-2 py-1 backdrop-blur-md">
              <Star className="size-4 fill-secondary text-secondary" />
              <strong className="font-heading text-base text-on-surface">{movie.score}</strong>
              <span>/10 ({movie.reviews})</span>
            </div>
            <span>•</span><span>{movie.genres}</span><span>•</span>
            <span className="flex items-center gap-1"><Clock3 className="size-4" />{movie.duration}</span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">{movie.synopsis}</p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <a href="#quick-booking" className="flex items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3 font-heading text-base font-semibold text-white shadow-crimson-strong transition-transform hover:-translate-y-0.5">
              <Ticket className="size-5" /> Book Tickets Now
            </a>
            <button type="button" className="flex items-center justify-center gap-2 rounded-lg bg-surface-container-highest/70 px-6 py-3 font-heading text-base font-semibold text-on-surface backdrop-blur-md transition-colors hover:bg-surface-container-highest">
              <CirclePlay className="size-5 fill-secondary text-secondary" /> Watch Trailer
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroBanner
