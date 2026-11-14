import { ClockAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function BookingExpiryDialog({ onRestart }) {
  const buttonRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    buttonRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section role="alertdialog" aria-modal="true" aria-labelledby="booking-expired-title" aria-describedby="booking-expired-description" className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
        <div className="h-1 bg-gradient-to-r from-primary-container via-primary to-primary-container" />
        <div className="p-6 text-center sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ClockAlert className="size-7" aria-hidden="true" /></span>
          <h2 id="booking-expired-title" className="mt-5 font-heading text-2xl font-bold text-white">Your reservation has expired</h2>
          <p id="booking-expired-description" className="mt-3 text-sm leading-6 text-on-surface-variant">The selected seats are no longer being held. Please start again to view the latest seat availability.</p>
          <button ref={buttonRef} type="button" onClick={onRestart} className="mt-6 w-full rounded-xl bg-primary-container px-5 py-3 font-bold text-white shadow-crimson hover:opacity-90">Select seats again</button>
        </div>
      </section>
    </div>
  )
}
