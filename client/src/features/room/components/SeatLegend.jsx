import { Accessibility, X } from 'lucide-react'

// Each state differs by shape or glyph as well as colour, so the map never relies on colour alone.
const ITEMS = [
  { label: 'Standard', swatch: 'rounded-t-md rounded-b-sm bg-surface-container-high', note: 'Rounded seat' },
  { label: 'VIP', swatch: 'rounded-t-md rounded-b-sm border-t-4 border-secondary bg-secondary/15', note: 'Gold top bar' },
  { label: 'Double Luxury', swatch: 'rounded-full bg-primary-container/25 ring-1 ring-primary-container/70', note: 'Capsule' },
  {
    label: 'Accessible',
    swatch: 'rounded-t-md rounded-b-sm bg-blue-500/30 ring-2 ring-blue-400 text-blue-100',
    glyph: Accessibility,
    note: 'Marker on a seat',
  },
  {
    label: 'Blocked',
    swatch:
      'rounded-t-md rounded-b-sm bg-surface-container-high opacity-60 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,0.14)_3px_5px)]',
    glyph: X,
    note: 'Not sellable',
  },
  { label: 'Aisle / blank', swatch: 'rounded-sm border border-dashed border-white/25', note: 'No seat' },
]

function SeatLegend() {
  return (
    <ul aria-label="Seat map legend" className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface-container p-4 sm:grid-cols-3">
      {ITEMS.map(({ label, swatch, glyph: Glyph, note }) => (
        <li key={label} className="flex items-center gap-2.5">
          <span className={`grid size-6 shrink-0 place-items-center ${swatch}`} aria-hidden="true">
            {Glyph && <Glyph className="size-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-on-surface">{label}</span>
            <span className="block text-[10px] text-on-surface-variant">{note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default SeatLegend
