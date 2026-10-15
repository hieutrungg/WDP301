import { useState } from "react";
import { ChevronDown, LogOut, MapPin, Menu, Search, X } from "lucide-react";
import AppLogo from "./AppLogo";
import UserMenu from "./UserMenu";
import { getUserMenuItems } from "./userMenuItems";
import { Link, NavLink, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../features/auth/hooks/useAuth";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Movies", to: "/movies" },
  { label: "Theatres & Tickets", href: "/#theatres-&-tickets" },
  { label: "Offers", href: "/#offers" },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { account, initialized, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const displayName = account?.username || account?.email || "";
  const avatarLabel = displayName.charAt(0).toUpperCase();

  const handleMovieSearch = (event) => {
    event.preventDefault()
    const query = searchQuery.trim()
    navigate(query ? `/movies?q=${encodeURIComponent(query)}` : '/movies')
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      setMenuOpen(false);
      toast.success("Signed out successfully");
      navigate("/", { replace: true });
    } catch {
      toast.error("Unable to sign out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <AppLogo />
          <button
            type="button"
            className="hidden items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-variant xl:flex"
          >
            <MapPin className="size-4 text-primary-container" />
            <span>F-Cinema Landmark 81, HCMC</span>
            <ChevronDown className="size-4 text-on-surface-variant" />
          </button>
        </div>

        <nav
          className="hidden items-center lg:flex"
          aria-label="Main navigation"
        >
          {navItems.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm transition-colors hover:text-white ${isActive ? "bg-primary-container font-semibold text-white" : "text-on-surface-variant"}`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <form onSubmit={handleMovieSearch} className="relative hidden sm:block sm:w-40 xl:w-64">
            <label>
              <span className="sr-only">Search movies by title</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="Search movie titles..." className="w-full rounded-lg border-0 bg-surface-container-low py-2 pl-9 pr-3 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:bg-surface-container-high" />
            </label>
          </form>
          {initialized && !isAuthenticated && (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-white shadow-crimson transition-opacity hover:opacity-90 md:inline-flex"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="hidden rounded-lg bg-surface-container px-4 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container-high xl:inline-flex"
              >
                Register
              </Link>
            </>
          )}
          {initialized && isAuthenticated && (
            <UserMenu
              account={account}
              avatarLabel={avatarLabel}
              displayName={displayName}
              isLoggingOut={isLoggingOut}
              onLogout={handleLogout}
            />
          )}
          {!initialized && (
            <span className="hidden size-8 animate-pulse rounded-full bg-surface-container-high md:block" />
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-lg bg-surface-container text-on-surface lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/5 bg-surface-container-low px-4 py-4 lg:hidden">
          <nav
            className="mx-auto grid max-w-[1440px] gap-1"
            aria-label="Mobile navigation"
          >
            {navItems.map((item) =>
              item.to ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm hover:bg-surface-container-high ${isActive ? "bg-primary-container font-semibold text-white" : "text-on-surface"}`
                  }
                >
                  {item.label}
                </NavLink>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
                >
                  {item.label}
                </a>
              ),
            )}
            {initialized && !isAuthenticated && (
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-3">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg bg-surface-container-high px-4 py-2.5 text-center text-sm text-on-surface"
                >
                  Register
                </Link>
              </div>
            )}
            {initialized && isAuthenticated && (
              <div className="mt-2 grid gap-2 border-t border-white/5 pt-3">
                <div className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
                    {avatarLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {account.email}
                    </p>
                  </div>
                </div>
                {getUserMenuItems(account).map(({ label, to, icon: Icon }) =>
                  to ? (
                    <Link
                      key={label}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
                    >
                      <Icon className="size-4 text-on-surface-variant" />
                      {label}
                    </Link>
                  ) : (
                    <span
                      key={label}
                      aria-disabled="true"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-on-surface-variant/60"
                    >
                      <Icon className="size-4" />
                      {label}
                      <span className="ml-auto rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase">
                        Soon
                      </span>
                    </span>
                  ),
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut className="size-4" />
                  {isLoggingOut ? "Signing out..." : "Logout"}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;
