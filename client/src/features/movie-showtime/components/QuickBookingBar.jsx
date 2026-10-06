import { Bolt, CalendarDays, ChevronDown, Clock3, MapPin, Clapperboard } from 'lucide-react'

const icons = { movie: Clapperboard, location: MapPin, calendar: CalendarDays, time: Clock3 }
const iconColors = ['text-primary-container', 'text-secondary', 'text-tertiary-fixed', 'text-primary']

function QuickBookingBar({ steps }) {
  return (
    <section id="quick-booking" className="relative z-20 mx-auto -mt-10 mb-10 w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-white/5 bg-surface-container-low/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => {
            const Icon = icons[step.icon]
            return (
              <button key={step.label} type="button" className="group flex min-w-0 items-center gap-2 rounded-lg bg-surface-container p-2 text-left transition-colors hover:bg-surface-container-high">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-variant"><Icon className={`size-5 ${iconColors[index]}`} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{step.label}</span>
                  <span className="block truncate text-sm font-semibold text-on-surface">{step.value}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-y-0.5" />
              </button>
            )
          })}
          <button type="button" className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-primary-container font-heading text-base font-semibold text-white shadow-crimson transition-opacity hover:opacity-90">
            <Bolt className="size-5" /> Quick Booking
          </button>
        </div>
      </div>
    </section>
  )
}

export default QuickBookingBar
