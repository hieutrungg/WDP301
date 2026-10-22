import { Armchair, DoorOpen, Film, MonitorPlay } from 'lucide-react'
import { formatCount } from '../utils/roomFormat'

function SummaryCard({ label, icon: Icon, value, caption, loading, accent = 'text-on-surface', children }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <Icon className="size-4 text-on-surface-variant" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-surface-container-high" />
      ) : (
        <p className={`mt-2 font-heading text-3xl font-extrabold ${accent}`}>{value}</p>
      )}
      <p className="mt-1 text-xs text-on-surface-variant">{caption}</p>
      {children}
    </div>
  )
}

function RoomSummaryCards({ summary, loading, error }) {
  const isLoading = loading && !summary
  const show = (value) => (error && !summary ? '—' : formatCount(value))
  const average = summary && summary.totalRooms > 0 ? Math.round(summary.totalSeats / summary.totalRooms) : 0
  const topTypes = summary?.roomTypes?.slice(0, 3) ?? []

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        label="Total rooms"
        icon={DoorOpen}
        value={show(summary?.totalRooms)}
        caption={
          summary
            ? `${summary.active} active · ${summary.maintenance} maintenance · ${summary.inactive} inactive`
            : 'Active, maintenance and inactive'
        }
        loading={isLoading}
      />
      <SummaryCard
        label="Total seats"
        icon={Armchair}
        value={show(summary?.totalSeats)}
        caption={summary ? `Average ${average} per room` : 'Operational seats from seat maps'}
        loading={isLoading}
        accent="text-secondary"
      />
      <SummaryCard
        label="Room formats"
        icon={Film}
        value={show(summary?.roomTypes?.length)}
        caption={summary && summary.withoutLayout > 0 ? `${summary.withoutLayout} without a seat map` : 'Distinct room types'}
        loading={isLoading}
      >
        {topTypes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topTypes.map(({ roomType, count }) => (
              <span
                key={roomType}
                className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-bold uppercase text-tertiary"
              >
                {roomType} · {count}
              </span>
            ))}
          </div>
        )}
      </SummaryCard>
      <SummaryCard
        label="In programming"
        icon={MonitorPlay}
        value={summary ? `${summary.roomsWithUpcomingShowtimes} / ${summary.totalRooms}` : show(undefined)}
        caption={summary ? `${summary.upcomingShowtimes} upcoming published showtimes` : 'Rooms with upcoming showtimes'}
        loading={isLoading}
      />
    </div>
  )
}

export default RoomSummaryCards
