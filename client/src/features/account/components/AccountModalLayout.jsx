import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useNavigate } from 'react-router'
import { useAccountNavigation } from '../hooks/useAccountNavigation'
import './AccountModalLayout.css'

export default function AccountModalLayout() {
  const dialogRef = useRef(null)
  const navigate = useNavigate()
  const { homePath } = useAccountNavigation()
  const close = () => navigate(homePath, { replace: true })
  useEffect(() => { dialogRef.current?.showModal() }, [])
  if (typeof document === 'undefined') return <Outlet />
  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="personal-account-modal-title"
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-background p-0 text-on-surface shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[calc(90dvh-2px)] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-surface-container-low p-4">
        <h2 id="personal-account-modal-title" className="font-heading text-lg font-bold">My Account</h2>
        <button type="button" autoFocus onClick={close} aria-label="Close My Account" className="grid size-9 place-items-center rounded-lg hover:bg-surface-container-high"><X className="size-4" /></button>
      </div>
      <div className="account-modal-body min-h-0 overflow-y-auto overscroll-contain">
        <Outlet />
      </div>
      </div>
    </dialog>, document.body,
  )
}
