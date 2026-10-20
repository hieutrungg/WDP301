import CinemaExperienceSection from '../../features/movie-showtime/components/CinemaExperienceSection'
import HeroBanner from '../../features/movie-showtime/components/HeroBanner'
import MembershipBanner from '../../features/movie-showtime/components/MembershipBanner'
import NowShowingSection from '../../features/movie-showtime/components/NowShowingSection'
import ComingSoonSection from '../../features/movie-showtime/components/ComingSoonSection'
import { useMovies } from '../../features/movie-showtime/hooks/useMovies'

const homeMoviesQuery = 'page=1&limit=24&sort=releaseDate&order=desc'

function getVietnamDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function LandingPage() {
  const { movies, loading, error, retry } = useMovies(homeMoviesQuery)
  const today = getVietnamDateKey()
  const nowShowing = movies.filter(({ releaseDate }) => releaseDate?.slice(0, 10) <= today).slice(0, 5)
  const comingSoon = movies.filter(({ releaseDate }) => releaseDate?.slice(0, 10) > today).slice(0, 4)
  const featuredMovie = nowShowing[0] ?? movies[0]

  return (
    <div className="pt-20">
      <HeroBanner movie={featuredMovie} loading={loading} />
      <NowShowingSection movies={nowShowing} loading={loading} error={error} onRetry={retry} />
      {!loading && !error && <ComingSoonSection movies={comingSoon} />}
      <CinemaExperienceSection />
      <MembershipBanner />
    </div>
  )
}

export default LandingPage
