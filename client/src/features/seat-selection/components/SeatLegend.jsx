import { Accessibility, Heart, LockKeyhole, X } from 'lucide-react'

const labels = {
  STANDARD: 'Standard',
  VIP: 'VIP Prime',
  DOUBLE_LUXURY: 'Sweetbox',
}

const typeClasses = {
  STANDARD: 'border-white/15 bg-surface-container-highest',
  VIP: 'border-secondary/60 bg-secondary-container/20 text-secondary',
  DOUBLE_LUXURY: 'border-tertiary-fixed-dim/50 bg-tertiary-container/30 text-tertiary',
}

function SeatLegend({ seatTypes, selectedCount }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-on-surface-variant">
      {seatTypes.map((seat) => (
        <div key={`${seat.type}:${seat.price}`} className="flex items-center gap-2">
          <span className={`grid h-6 min-w-6 place-items-center rounded border px-1 ${typeClasses[seat.type] ?? typeClasses.STANDARD}`}>
            {seat.type === 'DOUBLE_LUXURY' ? <Heart className="size-3" /> : seat.type === 'VIP' ? 'VIP' : ''}
          </span>
          <span><strong className="block text-on-surface">{labels[seat.type] ?? seat.type}</strong>{seat.formattedPrice}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded border border-white bg-primary-container text-white shadow-crimson">✓</span>
        <span><strong className="block text-on-surface">Selected ({selectedCount})</strong>Your seats</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded border border-secondary bg-secondary/20 text-secondary"><LockKeyhole className="size-3.5" /></span>
        <span><strong className="block text-on-surface">Held by you</strong>Your active hold</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded bg-surface-container-highest text-tertiary-container opacity-50"><X className="size-3.5" /></span>
        <span><strong className="block text-on-surface">Unavailable</strong>Held or sold</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded border border-dashed border-white/20 bg-surface-container-lowest text-tertiary-container opacity-35"><X className="size-3.5" /></span>
        <span><strong className="block text-on-surface">Disabled</strong>Not selectable</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded border border-blue-500/40 bg-blue-950/60 text-blue-400"><Accessibility className="size-3.5" /></span>
        <span><strong className="block text-on-surface">Accessible</strong>Wheelchair space</span>
      </div>
    </div>
  )
}

export default SeatLegend

