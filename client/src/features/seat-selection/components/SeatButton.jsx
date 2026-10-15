import { Accessibility, X } from 'lucide-react'

const stateClasses = {
  SELECTED: 'scale-110 border-white bg-primary-container text-white shadow-[0_0_12px_rgba(229,9,20,0.8)]',
  HELD_BY_CURRENT_OWNER: 'border-secondary bg-secondary/20 text-secondary shadow-[0_0_10px_rgba(255,214,91,0.2)]',
  HELD: 'cursor-not-allowed border-transparent bg-surface-container-highest text-tertiary-container opacity-45',
  SOLD: 'cursor-not-allowed border-transparent bg-surface-container-lowest text-tertiary-container opacity-35',
  UNAVAILABLE: 'cursor-not-allowed border-transparent bg-surface-container-lowest text-tertiary-container opacity-30',
}

const typeClasses = {
  STANDARD: 'border-white/10 bg-surface-container-highest/70 text-on-surface hover:border-white/30 hover:bg-surface-bright',
  VIP: 'border-secondary/60 bg-secondary-container/15 text-secondary hover:bg-secondary/25',
  DOUBLE_LUXURY: 'border-tertiary-fixed-dim/50 bg-tertiary-container/25 text-tertiary hover:bg-tertiary-container/50',
}

const stateLabels = {
  AVAILABLE: 'Available',
  SELECTED: 'Selected',
  HELD_BY_CURRENT_OWNER: 'Held by you',
  HELD: 'Unavailable',
  SOLD: 'Sold',
  UNAVAILABLE: 'Disabled',
}

function SeatButton({ seat, selected, onToggle, disabled }) {
  const displayState = selected ? 'SELECTED' : seat.availability
  const isDisabled = disabled || !['AVAILABLE', 'SELECTED'].includes(displayState)
  const label = `${seat.row}${seat.number}, ${seat.type}, ${stateLabels[displayState] ?? displayState}`
  const classes = stateClasses[displayState] ?? typeClasses[seat.type] ?? typeClasses.STANDARD

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onToggle(seat.seatId)}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`relative grid h-7 w-7 place-items-center rounded border font-mono text-[9px] font-bold transition sm:h-8 sm:w-8 sm:text-[10px] ${classes}`}
    >
      {['UNAVAILABLE', 'SOLD', 'HELD'].includes(displayState) ? (
        <X className="size-3.5" aria-hidden="true" />
      ) : seat.isAccessible ? (
        <Accessibility className="size-3.5" aria-hidden="true" />
      ) : (
        String(seat.number).padStart(2, '0')
      )}
      <span className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-current opacity-40" />
    </button>
  )
}

export default SeatButton

