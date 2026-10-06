import CinemaExperienceSection from '../../features/movie-showtime/components/CinemaExperienceSection'
import ComingSoonSection from '../../features/movie-showtime/components/ComingSoonSection'
import HeroBanner from '../../features/movie-showtime/components/HeroBanner'
import MembershipBanner from '../../features/movie-showtime/components/MembershipBanner'
import NowShowingSection from '../../features/movie-showtime/components/NowShowingSection'
import QuickBookingBar from '../../features/movie-showtime/components/QuickBookingBar'
import {
  bookingSteps,
  comingSoonMovies,
  heroMovie,
  nowShowingMovies,
} from '../../features/movie-showtime/data/movieMockData'

function LandingPage() {
  return (
    <div className="pt-20">
      <HeroBanner movie={heroMovie} />
      <QuickBookingBar steps={bookingSteps} />
      <NowShowingSection movies={nowShowingMovies} />
      <ComingSoonSection movies={comingSoonMovies} />
      <CinemaExperienceSection />
      <MembershipBanner />
    </div>
  )
}

export default LandingPage
