import { X } from 'lucide-react'

const stateClasses = {
  AVAILABLE: 'border-white/15 bg-surface-container-high text-on-surface hover:border-secondary/60 hover:bg-secondary/10',
  SELECTED: 'border-primary bg-primary-container text-white shadow-crimson',
  HELD_BY_CURRENT_OWNER: 'border-secondary bg-secondary/20 text-secondary',
  HELD: 'cursor-not-allowed border-transparent bg-surface-container-highest text-tertiary-container opacity-55',
  SOLD: 'cursor-not-allowed border-transparent bg-surface-container-highest text-tertiary-container opacity-55',
  UNAVAILABLE: 'cursor-not-allowed border-transparent bg-surface-container-lowest text-tertiary-container opacity-40',
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

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onToggle(seat.seatId)}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`relative grid h-10 w-10 place-items-center rounded-t-lg rounded-b-sm border text-[11px] font-bold transition sm:h-11 sm:w-11 ${stateClasses[displayState] ?? stateClasses.HELD}`}
    >
      {displayState === 'UNAVAILABLE' ? <X className="size-4" aria-hidden="true" /> : seat.number}
      <span className="absolute -bottom-1 h-1 w-7 rounded-full bg-current opacity-50" />
    </button>
  )
}

export default SeatButton

