const items = [
  ['bg-surface-container-high border-white/15', 'Available'],
  ['bg-primary-container border-primary', 'Selected'],
  ['bg-secondary/20 border-secondary', 'Held by you'],
  ['bg-surface-container-highest border-transparent opacity-55', 'Unavailable'],
  ['bg-surface-container-lowest border-transparent opacity-40', 'Disabled'],
]

function SeatLegend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-on-surface-variant">
      {items.map(([classes, label]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <span className={`size-3 rounded-sm border ${classes}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  )
}

export default SeatLegend

