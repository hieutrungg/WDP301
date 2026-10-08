import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { userMenuItems } from './userMenuItems'

function UserMenu({ account, avatarLabel, displayName, isLoggingOut, onLogout }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative hidden md:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-container px-2.5 py-1.5 transition-colors hover:bg-surface-container-high"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
          {avatarLabel}
        </span>
        <span className="max-w-32 truncate text-xs font-semibold text-on-surface xl:max-w-44">
          {displayName}
        </span>
        <ChevronDown
          className={`size-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* pt-2 bridges the gap so the menu stays open while the cursor moves into it */}
      <div
        className={`absolute right-0 top-full w-64 pt-2 transition-all duration-150 ${open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}
      >
        <div
          role="menu"
          className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {avatarLabel}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
              <p className="truncate text-xs text-on-surface-variant">{account.email}</p>
            </div>
          </div>

          <div className="p-1.5">
            {userMenuItems.map(({ label, to, icon: Icon }) =>
              to ? (
                <Link
                  key={label}
                  to={to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Icon className="size-4 text-on-surface-variant" />
                  {label}
                </Link>
              ) : (
                <span
                  key={label}
                  role="menuitem"
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-on-surface-variant/60"
                >
                  <Icon className="size-4" />
                  {label}
                  <span className="ml-auto rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase">
                    Soon
                  </span>
                </span>
              ),
            )}
          </div>

          <div className="border-t border-white/5 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-primary transition-colors hover:bg-primary-container/15 disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut className="size-4" />
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserMenu
