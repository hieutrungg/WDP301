import { LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../../features/auth/hooks/useAuth'

export default function InternalAccountMenu({ profilePath }) {
  const { account, logout } = useAuth()
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = account?.profile?.fullName || account?.username || 'My Account'
  const role = account?.roles?.map(({ name }) => name).join(', ')
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const signOut = async () => {
    setBusy(true)
    try {
      await logout()
      setOpen(false)
      toast.success('Signed out successfully')
      navigate('/', { replace: true })
    } catch {
      toast.error('Unable to sign out. Please try again.')
    } finally { setBusy(false) }
  }
  return <div ref={rootRef} className="relative">
    <button ref={triggerRef} type="button" aria-label="Open My Account menu" aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg p-1.5 transition hover:bg-surface-container-high">
      <span className="hidden min-w-0 text-right sm:block">
        <span className="block max-w-48 truncate text-sm font-semibold">{name}</span>
        <span className="block max-w-48 truncate text-[11px] text-on-surface-variant">{role}</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">{name.charAt(0).toUpperCase()}</span>
    </button>
    {open && <div className="absolute right-0 top-full z-50 mt-2 grid w-52 gap-1 rounded-xl border border-white/10 bg-surface-container-low p-2 shadow-xl">
      <Link to={profilePath} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-surface-container-high"><UserRound className="size-4" />My Account</Link>
      <button type="button" disabled={busy} onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"><LogOut className="size-4" />{busy ? 'Signing out...' : 'Logout'}</button>
    </div>}
  </div>
}
