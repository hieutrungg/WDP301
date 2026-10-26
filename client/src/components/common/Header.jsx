import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, MapPin, Menu, Search, X } from "lucide-react";
import AppLogo from "./AppLogo";
import UserMenu from "./UserMenu";
import { getUserMenuItems } from "./userMenuItems";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getPublicCinemas } from "../../lib/api/publicCinemaApi";
import { useSelectedBranchStore } from "../../lib/store/selectedBranchStore";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Movies", to: "/movies" },
  { label: "Food & Drink", to: "/concessions" },
  { label: "Theatres & Tickets", href: "/#theatres-&-tickets" },
  { label: "Offers" },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { account, initialized, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState(false);
  const [branchesRequest, setBranchesRequest] = useState(0);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchPickerRef = useRef(null);
  const selectedBranchId = useSelectedBranchStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useSelectedBranchStore((state) => state.setSelectedBranchId);
  const selectedBranch = branches.find(({ id }) => id === selectedBranchId);
  const displayName = account?.username || account?.email || "";
  const avatarLabel = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const controller = new AbortController();
    const loadBranches = async () => {
      setBranchesLoading(true);
      setBranchesError(false);
      try {
        const firstPage = await getPublicCinemas({ page: 1, limit: 50 }, controller.signal);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
            getPublicCinemas({ page: index + 2, limit: 50 }, controller.signal),
          ),
        );
        const allBranches = [firstPage, ...remainingPages].flatMap(({ items }) => items);
        setBranches(allBranches);
      } catch {
        if (!controller.signal.aborted) setBranchesError(true);
      } finally {
        if (!controller.signal.aborted) setBranchesLoading(false);
      }
    };
    loadBranches();
    return () => controller.abort();
  }, [branchesRequest, setSelectedBranchId]);

  useEffect(() => {
    if (!branchesLoading && !branchesError && selectedBranchId && !branches.some(({ id }) => id === selectedBranchId)) {
      setSelectedBranchId("");
    }
  }, [branches, branchesError, branchesLoading, selectedBranchId, setSelectedBranchId]);

  useEffect(() => {
    if (!branchMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!branchPickerRef.current?.contains(event.target)) setBranchMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setBranchMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [branchMenuOpen]);

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
          <div className="relative hidden min-[1400px]:block" ref={branchPickerRef}>
            <button
              type="button"
              onClick={() => setBranchMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={branchMenuOpen}
              aria-label="Choose a cinema branch"
              className="flex max-w-[250px] items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-variant"
            >
              <MapPin className="size-4 shrink-0 text-primary-container" />
              <span className="truncate">{selectedBranch?.branchName || (branchesLoading ? "Loading cinemas…" : branchesError ? "Cinemas unavailable" : "All cinemas")}</span>
              <ChevronDown className={`size-4 shrink-0 text-on-surface-variant transition-transform ${branchMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {branchMenuOpen && (
              <div role="menu" aria-label="Cinema branches" className="absolute left-0 top-full z-[60] mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-white/10 bg-surface-container-low p-2 shadow-2xl">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!selectedBranchId}
                  onClick={() => { setSelectedBranchId(""); setBranchMenuOpen(false) }}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-on-surface hover:bg-surface-container-high"
                >All active branches</button>
                {branchesLoading ? (
                  <p role="status" className="px-3 py-4 text-sm text-on-surface-variant">Loading branches…</p>
                ) : branchesError ? (
                  <div className="px-3 py-3 text-sm text-on-surface-variant"><p>Could not load branches.</p><button type="button" onClick={() => setBranchesRequest((value) => value + 1)} className="mt-2 font-semibold text-primary hover:underline">Try again</button></div>
                ) : branches.length ? branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedBranchId === branch.id}
                    onClick={() => { setSelectedBranchId(branch.id); setBranchMenuOpen(false) }}
                    className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-surface-container-high"
                  >
                    <span className="block text-sm font-semibold text-on-surface">{branch.branchName}</span>
                    <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{branch.address}</span>
                  </button>
                )) : <p className="px-3 py-4 text-sm text-on-surface-variant">No active branches are available.</p>}
              </div>
            )}
          </div>
        </div>

        <nav
          className="hidden items-center whitespace-nowrap lg:flex"
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
            ) : item.href ? (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <span key={item.label} aria-disabled="true" className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-on-surface-variant/50">
                {item.label}<span className="ml-1 text-[10px]">Soon</span>
              </span>
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
                state={{ from: location }}
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
              ) : item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
                >
                  {item.label}
                </a>
              ) : (
                <span key={item.label} aria-disabled="true" className="cursor-not-allowed rounded-lg px-3 py-2.5 text-sm text-on-surface-variant/50">
                  {item.label}<span className="ml-2 text-[10px]">Soon</span>
                </span>
              ),
            )}
            {initialized && !isAuthenticated && (
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-3">
                <Link
                  to="/login"
                  state={{ from: location }}
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
