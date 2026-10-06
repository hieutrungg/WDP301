import { useState } from 'react'
import { ChevronDown, MapPin, Menu, Search, UserRound, X } from 'lucide-react'
import AppLogo from './AppLogo'

const navItems = ['Home', 'Movies', 'Showtimes', 'Theatres & Tickets', 'Offers']

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <AppLogo />
          <button type="button" className="hidden items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-variant xl:flex">
            <MapPin className="size-4 text-primary-container" />
            <span>F-Cinema Landmark 81, HCMC</span>
            <ChevronDown className="size-4 text-on-surface-variant" />
          </button>
        </div>

        <nav className="hidden items-center lg:flex" aria-label="Main navigation">
          {navItems.map((item, index) => (
            <a
              key={item}
              href={index === 0 ? '/' : `#${item.toLowerCase().replaceAll(' ', '-')}`}
              className={`rounded-lg px-3 py-2 text-sm transition-colors hover:text-white ${index === 0 ? 'font-semibold text-white' : 'text-on-surface-variant'}`}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <label className="relative hidden sm:block sm:w-40 xl:w-64">
            <span className="sr-only">Search movies and actors</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <input type="search" placeholder="Search movies, actors..." className="w-full rounded-lg border-0 bg-surface-container-low py-2 pl-9 pr-3 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:bg-surface-container-high" />
          </label>
          <a href="/login" className="hidden rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-white shadow-crimson transition-opacity hover:opacity-90 md:inline-flex">
            Sign In
          </a>
          <a href="#register" className="hidden rounded-lg bg-surface-container px-4 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container-high xl:inline-flex">
            Register
          </a>
          <span className="hidden size-8 items-center justify-center rounded-full bg-primary text-on-primary md:flex">
            <UserRound className="size-4" />
          </span>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="grid size-10 place-items-center rounded-lg bg-surface-container text-on-surface lg:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/5 bg-surface-container-low px-4 py-4 lg:hidden">
          <nav className="mx-auto grid max-w-[1440px] gap-1" aria-label="Mobile navigation">
            {navItems.map((item, index) => (
              <a key={item} href={index === 0 ? '/' : `#${item.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-high">
                {item}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-white/5 pt-3">
              <a href="/login" className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-center text-sm font-bold text-white">Sign In</a>
              <a href="#register" className="flex-1 rounded-lg bg-surface-container-high px-4 py-2.5 text-center text-sm text-on-surface">Register</a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header
