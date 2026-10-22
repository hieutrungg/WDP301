import { BadgeCheck, CalendarClock, ClipboardCheck, Radio } from 'lucide-react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { employeeInitials, formatDateLabel, formatTime } from '../utils/staffShiftFormat'

const cardClass = 'rounded-2xl border border-white/5 bg-surface-container-low p-4'

function StatCard({ label, icon: Icon, value, caption, loading, accent = 'text-on-surface', onClick, actionLabel, children }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <Icon className="size-4 text-on-surface-variant" aria-hidden="true" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-surface-container-high" />
      ) : (
        <p className={`mt-2 font-heading text-3xl font-extrabold ${accent}`}>{value}</p>
      )}
      <p className="mt-1 text-xs text-on-surface-variant">{caption}</p>
      {actionLabel && <p className="mt-2 text-xs font-bold text-primary">{actionLabel}</p>}
      {children}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cardClass} text-left transition-colors hover:border-primary/40 hover:bg-surface-container`}
      >
        {body}
      </button>
    )
  }

  return <div className={cardClass}>{body}</div>
}

function Panel({ title, caption, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low">
      <header className="border-b border-white/5 px-4 py-3">
        <h2 className="font-heading text-sm font-bold text-on-surface">{title}</h2>
        <p className="text-xs text-on-surface-variant">{caption}</p>
      </header>
      {children}
    </section>
  )
}

function ShiftLine({ shift, trailing }) {
  return (
    <li className="flex items-center gap-3 border-t border-white/5 px-4 py-2.5 first:border-t-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-container-highest text-[11px] font-bold text-on-surface">
        {employeeInitials(shift.employee?.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{shift.employee?.fullName ?? 'Unknown employee'}</p>
        <p className="truncate text-xs text-on-surface-variant">{shift.station ?? 'No position'}</p>
      </div>
      <p className="whitespace-nowrap text-xs text-on-surface-variant">{trailing}</p>
    </li>
  )
}

function PanelMessage({ children }) {
  return <p className="px-4 py-6 text-center text-sm text-on-surface-variant">{children}</p>
}

// UC38 steps 1-2. The cards describe the date being viewed (today by default); the planned schedule
// only, not who actually turned up. "Awaiting approval" is the backlog across ALL dates, so a shift
// finished on an earlier day is never hidden and approving any shift visibly changes it.
function ShiftDashboard({ dashboard, onRetry, onReviewAwaiting }) {
  const { data, loading, error } = dashboard
  const isLoading = loading && !data
  const totals = data?.totals
  const show = (value) => (error && !data ? '—' : (value ?? 0))
  const when = data ? (data.isToday ? 'today' : `on ${formatDateLabel(data.date)}`) : 'today'
  const awaitingTotal = data?.awaitingApprovalTotal ?? 0

  return (
    <div className="space-y-4">
      {error && !data && (
        <p role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
          {getApiErrorMessage(error)}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In progress"
          icon={Radio}
          value={show(totals?.inProgress)}
          caption={totals ? `of ${totals.shifts} shifts ${when}` : 'Shifts running now'}
          loading={isLoading}
          accent="text-secondary"
        >
          {data?.stations?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="In progress by position">
              {data.stations.map(({ station, inProgress }) => (
                <li key={station} className="rounded bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface">
                  {station}: {inProgress}
                </li>
              ))}
            </ul>
          )}
        </StatCard>
        <StatCard label="Scheduled" icon={CalendarClock} value={show(totals?.scheduled)} caption={`Not started yet, ${when}`} loading={isLoading} />
        <StatCard
          label="Awaiting approval"
          icon={ClipboardCheck}
          value={show(data?.awaitingApprovalTotal)}
          caption={totals ? `All dates · ${totals.completed} ${when}` : 'Finished, not yet approved'}
          loading={isLoading}
          accent={awaitingTotal > 0 ? 'text-primary' : 'text-on-surface'}
          onClick={awaitingTotal > 0 && onReviewAwaiting ? onReviewAwaiting : undefined}
          actionLabel={awaitingTotal > 0 && onReviewAwaiting ? 'Review all →' : undefined}
        />
        <StatCard
          label="Approved"
          icon={BadgeCheck}
          value={show(totals?.approved)}
          caption={totals ? `${totals.cancelled} cancelled ${when}` : 'Signed off by a manager'}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="On shift now" caption="Shifts whose planned time is running">
          {isLoading ? (
            <PanelMessage>Loading…</PanelMessage>
          ) : data?.inProgress?.length ? (
            <ul>
              {data.inProgress.map((shift) => (
                <ShiftLine key={shift.id} shift={shift} trailing={`until ${formatTime(shift.endTime)}`} />
              ))}
            </ul>
          ) : (
            <PanelMessage>
              {error
                ? 'Not available right now.'
                : data?.isToday === false
                  ? 'Running shifts are shown when you view today.'
                  : 'No shift is running right now.'}
            </PanelMessage>
          )}
        </Panel>

        <Panel title="Up next" caption={`The next scheduled shifts ${when}`}>
          {isLoading ? (
            <PanelMessage>Loading…</PanelMessage>
          ) : data?.upcoming?.length ? (
            <ul>
              {data.upcoming.map((shift) => (
                <ShiftLine key={shift.id} shift={shift} trailing={`starts ${formatTime(shift.startTime)}`} />
              ))}
            </ul>
          ) : (
            <PanelMessage>{error ? 'Not available right now.' : `No more shifts are scheduled ${when}.`}</PanelMessage>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default ShiftDashboard
