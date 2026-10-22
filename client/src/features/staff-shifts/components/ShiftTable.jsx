import { BadgeCheck, ClipboardCheck, Eye } from 'lucide-react'
import ShiftStatusBadge from './ShiftStatusBadge'
import {
  employeeInitials,
  formatDateLabel,
  formatDateTime,
  formatMinutes,
  formatTime,
  localDateOf,
  plannedMinutes,
} from '../utils/staffShiftFormat'

const headClass = 'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant'

function ScheduleCell({ shift }) {
  const crossesMidnight = localDateOf(shift.startTime) !== localDateOf(shift.endTime)

  return (
    <div>
      <p className="whitespace-nowrap font-semibold text-on-surface">
        {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
        {crossesMidnight && <span className="ml-1 text-[11px] font-bold text-secondary">+1 day</span>}
      </p>
      <p className="text-xs text-on-surface-variant">
        {formatDateLabel(localDateOf(shift.startTime))} · {formatMinutes(plannedMinutes(shift))} planned
      </p>
    </div>
  )
}

// Who approved (or cancelled) the shift, and when.
function OutcomeCell({ shift }) {
  if (shift.approval) {
    return (
      <div className="text-xs">
        <p className="inline-flex items-center gap-1 font-bold text-secondary">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          Approved
        </p>
        <p className="text-on-surface-variant">
          {shift.approval.approvedBy?.fullName ?? 'Manager'} · {formatDateTime(shift.approval.approvedAt)}
        </p>
      </div>
    )
  }

  if (shift.cancellation) {
    return (
      <div className="text-xs text-on-surface-variant">
        <p className="font-bold text-error">Cancelled</p>
        <p>
          {shift.cancellation.cancelledBy?.fullName ?? 'Manager'} · {formatDateTime(shift.cancellation.cancelledAt)}
        </p>
      </div>
    )
  }

  if (shift.canApprove) {
    return <span className="text-xs font-semibold text-primary">Ready to approve</span>
  }

  return <span className="text-xs text-on-surface-variant/70">—</span>
}

const rowTone = (shift) => {
  if (shift.status === 'CANCELLED') return 'opacity-70'
  if (shift.canApprove) return 'bg-primary-container/5'
  return ''
}

function ShiftTable({ items, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="bg-surface-container-high/60">
          <tr>
            <th scope="col" className={headClass}>Employee</th>
            <th scope="col" className={headClass}>Work position</th>
            <th scope="col" className={headClass}>Shift</th>
            <th scope="col" className={headClass}>Status</th>
            <th scope="col" className={headClass}>Approval</th>
            <th scope="col" className={`${headClass} text-right`}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((shift) => (
            <tr key={shift.id} className={`border-t border-white/5 ${rowTone(shift)}`}>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-container-highest text-xs font-bold text-on-surface">
                    {employeeInitials(shift.employee?.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-on-surface">{shift.employee?.fullName ?? 'Unknown employee'}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {[shift.employee?.position, shift.employee?.phone].filter(Boolean).join(' · ') || shift.employee?.username || '—'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5 font-semibold text-on-surface">{shift.station ?? '—'}</td>
              <td className="px-4 py-3.5"><ScheduleCell shift={shift} /></td>
              <td className="px-4 py-3.5"><ShiftStatusBadge status={shift.status} /></td>
              <td className="px-4 py-3.5"><OutcomeCell shift={shift} /></td>
              <td className="px-4 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => onOpen(shift.id)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest"
                  aria-label={`${shift.canApprove ? 'Review' : 'View'} shift of ${shift.employee?.fullName ?? 'employee'}`}
                >
                  {shift.canApprove ? <ClipboardCheck className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                  {shift.canApprove ? 'Review' : 'View'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ShiftTable
