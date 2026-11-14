import { Armchair, Building2, CalendarClock, Clapperboard, Ticket } from 'lucide-react'
import { useSearchParams } from 'react-router'

function TicketInfoPage() {
  const [params] = useSearchParams()
  const details = [
    { label: 'Movie', value: params.get('movie'), icon: Clapperboard },
    { label: 'Cinema', value: params.get('cinema'), icon: Building2 },
    { label: 'Room', value: params.get('room'), icon: Building2 },
    { label: 'Showtime', value: params.get('showtime'), icon: CalendarClock },
    { label: 'Seat', value: params.get('seat'), icon: Armchair },
  ]
  const code = params.get('code')

  return (
    <main className="grid min-h-screen place-items-center bg-[#0d0e12] px-4 py-10 text-white">
      <article className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#282126] to-[#161618] shadow-2xl">
        <header className="border-b border-dashed border-white/15 p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">F-Cinema</p>
          <h1 className="mt-2 font-heading text-2xl font-black">Admission Ticket</h1>
          <p className="mt-2 text-xs text-on-surface-variant">Present this ticket at the cinema entrance.</p>
        </header>
        <dl className="space-y-3 p-6">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-black/20 p-4">
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                <Icon className="size-4 text-secondary" /> {label}
              </dt>
              <dd className="mt-1 font-heading text-lg font-bold">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <footer className="border-t border-dashed border-white/15 bg-black/20 p-6 text-center">
          <Ticket className="mx-auto size-6 text-secondary" />
          <p className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant">Check-in code</p>
          <strong className="mt-1 block font-mono text-xl tracking-wider text-secondary">{code || 'Invalid ticket link'}</strong>
        </footer>
      </article>
    </main>
  )
}

export default TicketInfoPage
