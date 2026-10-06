import { Stars } from 'lucide-react'

function MembershipBanner() {
  return (
    <section id="register" className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-low p-6 shadow-2xl lg:flex-row lg:p-10">
        <span className="pointer-events-none absolute -bottom-10 -right-10 size-64 rounded-full bg-primary-container/15 blur-3xl" />
        <div className="relative max-w-xl text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded bg-secondary-container/20 px-2 py-1 text-[11px] font-bold uppercase text-secondary"><Stars className="size-4" />F-Club VIP Privileges</span>
          <h2 className="mt-2 font-heading text-2xl font-bold text-on-surface sm:text-3xl">Earn Points Every Frame, Redeem Free Tickets</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">Register today to immediately enjoy a 20% discount on your first booking and reserve prime seats at all IMAX theaters nationwide.</p>
        </div>
        <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a href="#" className="rounded-lg bg-primary-container px-8 py-3 text-center font-heading text-base font-semibold text-white shadow-crimson">Join F-Club</a>
          <a href="#" className="rounded-lg bg-surface-container-highest px-5 py-3 text-center text-sm text-on-surface transition-colors hover:bg-surface-variant">View Privileges</a>
        </div>
      </div>
    </section>
  )
}

export default MembershipBanner
