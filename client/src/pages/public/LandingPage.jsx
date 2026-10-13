import CinemaExperienceSection from '../../features/movie-showtime/components/CinemaExperienceSection'
import HeroBanner from '../../features/movie-showtime/components/HeroBanner'
import MembershipBanner from '../../features/movie-showtime/components/MembershipBanner'
import NowShowingSection from '../../features/movie-showtime/components/NowShowingSection'
import { useMovies } from '../../features/movie-showtime/hooks/useMovies'

const homeMoviesQuery = 'page=1&limit=5&sort=releaseDate&order=desc'

function LandingPage() {
  const { movies, loading, error, retry } = useMovies(homeMoviesQuery)

  return (
    <div className="pt-20">
      <HeroBanner movie={movies[0]} loading={loading} />
      <NowShowingSection movies={movies} loading={loading} error={error} onRetry={retry} />
      <CinemaExperienceSection />
      <MembershipBanner />
    </div>
  )
}

export default LandingPage
