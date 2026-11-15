import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'

const steps = ['Select Seats', 'Concessions', 'Checkout & Payment', 'Confirmation']

export default function BookingProgress({ currentStep, stepLinks = {}, aside }) {
  return (
    <nav
      aria-label="Booking progress"
      className="border-y border-white/10 bg-[#131315]/95 px-4 py-4 backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <ol className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 text-xs sm:gap-4 sm:text-sm">
          {steps.map((label, index) => {
            const step = index + 1
            const complete = step < currentStep
            const current = step === currentStep

            const content = (
              <>
                {complete ? (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                ) : (
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-[11px] font-black ${
                      current ? 'bg-primary text-white' : 'border border-white/15 text-on-surface-variant'
                    }`}
                  >
                    {step}
                  </span>
                )}
                {label}
              </>
            )

            return (
              <li key={label} className="contents">
                {complete && stepLinks[step] ? (
                  <Link
                    to={stepLinks[step]}
                    className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-400 transition hover:text-emerald-300 hover:underline"
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    aria-current={current ? 'step' : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 font-medium ${
                    complete
                      ? 'text-emerald-400'
                      : current
                        ? 'font-bold text-white'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {content}
                  </span>
                )}
                {step < steps.length && <span className="text-on-surface-variant" aria-hidden="true">›</span>}
              </li>
            )
          })}
        </ol>
        {aside}
      </div>
    </nav>
  )
}
