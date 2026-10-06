import { ArrowRight, Flame } from 'lucide-react'
import MovieCard from './MovieCard'

const genres = ['All', 'Action', 'Drama', 'Animation', 'Horror']

function NowShowingSection({ movies }) {
  return (
    <section id="movies" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-1 text-primary-container"><Flame className="size-5" /><span className="text-[11px] font-bold uppercase tracking-wider">Premium Experience</span></div>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Now Showing</h2>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-surface-container-low p-1">
            {genres.map((genre, index) => (
              <button key={genre} type="button" className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors ${index === 0 ? 'bg-primary-container font-semibold text-white' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>{genre}</button>
            ))}
          </div>
          <a href="#" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary sm:flex">View All <ArrowRight className="size-4" /></a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
      </div>
    </section>
  )
}

export default NowShowingSection
