import { Link } from 'react-router'
import { Clapperboard } from 'lucide-react'

function AppLogo({ className = '' }) {
  return (
    <Link
      to="/"
      className={`flex shrink-0 items-center gap-2 ${className}`}
      aria-label="F-Cinema home"
    >
      <span className="relative grid size-8 place-items-center rounded-lg bg-primary-container text-white shadow-crimson">
        <Clapperboard className="size-5" strokeWidth={2.5} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-surface bg-secondary" />
      </span>
      <span className="font-heading text-lg font-bold tracking-widest text-on-surface sm:text-xl">
        F-CINEMA
      </span>
    </Link>
  )
}

export default AppLogo
