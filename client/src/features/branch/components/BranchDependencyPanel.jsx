import { CalendarClock, CircleCheck, History, MonitorPlay, RefreshCw, ShieldAlert } from 'lucide-react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useBranchDetail } from '../hooks/useBranches'
import { formatDateTime } from '../utils/branchFormat'

function Fact({ icon: Icon, label, value, caption, highlight = false }) {
  return (
    <div
      className={`rounded-xl border p-3 ${highlight ? 'border-primary-container/40 bg-primary-container/10' : 'border-white/5 bg-surface-container'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <Icon className={`size-4 ${highlight ? 'text-primary' : 'text-on-surface-variant'}`} />
      </div>
      <p className={`mt-1 font-heading text-lg font-bold ${highlight ? 'text-primary' : 'text-on-surface'}`}>
        {value}
      </p>
      {caption && <p className="text-xs text-on-surface-variant">{caption}</p>}
    </div>
  )
}

// "View" inspector: the dependency facts behind the A-24 disable guard.
function BranchDependencyPanel({ branchId, refreshToken }) {
  const { data: branch, error, loading } = useBranchDetail(branchId, refreshToken)

  if (loading && !branch) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    )
  }

  if (error && !branch) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-on-error-container">
        <RefreshCw className="size-4" />
        {getApiErrorMessage(error)}
      </p>
    )
  }

  const blocked = branch.status === 'ACTIVE' && branch.upcomingShowtimeCount > 0

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact
          icon={MonitorPlay}
          label="Rooms"
          value={`${branch.roomCount} configured`}
          caption="Physical rooms and seat layouts"
        />
        <Fact
          icon={CalendarClock}
          label="Upcoming showtimes"
          value={`${branch.upcomingShowtimeCount} published`}
          caption="Published and not started yet"
          highlight={blocked}
        />
        <Fact
          icon={History}
          label="Last modified"
          value={formatDateTime(branch.updatedAt) ?? '—'}
          caption={`Created ${formatDateTime(branch.createdAt) ?? '—'}`}
        />
      </div>

      {branch.status === 'ACTIVE' &&
        (blocked ? (
          <p className="flex items-start gap-2 rounded-lg bg-error-container/30 px-3 py-2 text-xs text-on-error-container">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Disabling is blocked while this branch has upcoming published showtimes. Cancel or
            reschedule them first.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
            No upcoming published showtimes. This branch can be set to inactive.
          </p>
        ))}
    </div>
  )
}

export default BranchDependencyPanel
