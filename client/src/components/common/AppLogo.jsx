import { Link } from 'react-router'
import brandLogo from '../../assets/icons/f_cinema_brand_logo.png'

function AppLogo({ className = '' }) {
  return (
    <Link
      to="/"
      className={`flex shrink-0 items-center gap-4 ${className}`}
      aria-label="F-Cinema home"
    >
      <span className="relative size-8 shrink-0 overflow-hidden">
        <img
          src={brandLogo}
          alt=""
          aria-hidden="true"
          className="absolute -left-4 -top-4 h-16 w-16 max-w-none object-contain"
        />
      </span>
      <span className="font-heading text-lg font-bold tracking-widest text-on-surface sm:text-xl">
        F-CINEMA
      </span>
    </Link>
  )
}

export default AppLogo
