import CinemaExperienceSection from '../../features/movie-showtime/components/CinemaExperienceSection'
import HeroBanner from '../../features/movie-showtime/components/HeroBanner'
import MembershipBanner from '../../features/movie-showtime/components/MembershipBanner'
import NowShowingSection from '../../features/movie-showtime/components/NowShowingSection'
import ComingSoonSection from '../../features/movie-showtime/components/ComingSoonSection'
import { useMovies } from '../../features/movie-showtime/hooks/useMovies'
import { getVietnamDateKey } from '../../features/movie-showtime/utils/movieSearchParams'
import { useSelectedBranchStore } from '../../lib/store/selectedBranchStore'

const homeMoviesQuery = 'page=1&limit=24&sort=releaseDate&order=desc'

function LandingPage() {
  const cinemaId = useSelectedBranchStore((state) => state.selectedBranchId)
  const today = getVietnamDateKey()
  const allCinemas = useMovies(homeMoviesQuery)
  const branchQuery = new URLSearchParams({ cinemaId, releaseTo: today, limit: '5' }).toString()
  const atCinema = useMovies(branchQuery, { enabled: Boolean(cinemaId) })
  const { movies, loading, error, retry } = cinemaId ? atCinema : allCinemas
  const nowShowing = loading || error ? [] : movies.filter(({ releaseDate }) => releaseDate?.slice(0, 10) <= today).slice(0, 5)
  const comingSoon = allCinemas.movies.filter(({ releaseDate }) => releaseDate?.slice(0, 10) > today).slice(0, 4)
  const featuredMovie = nowShowing[0] ?? (cinemaId ? undefined : movies[0])

  return (
    <div className="pt-20">
      <HeroBanner movie={featuredMovie} loading={loading} cinemaId={cinemaId} />
      <NowShowingSection movies={nowShowing} loading={loading} error={error} onRetry={retry} cinemaId={cinemaId} />
      {!allCinemas.loading && !allCinemas.error && <ComingSoonSection movies={comingSoon} />}
      <CinemaExperienceSection />
      <MembershipBanner />
    </div>
  )
}

export default LandingPage
