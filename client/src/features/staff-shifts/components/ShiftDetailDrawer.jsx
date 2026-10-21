import { BadgeCheck, Ban, ClipboardCheck, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import { approveShiftRequest, cancelShiftRequest } from '../api/staffShiftApi'
import { useShift } from '../hooks/useStaffShifts'
import {
  HISTORY_LABELS,
  formatDateLabel,
  formatDateTime,
  formatMinutes,
  formatTime,
  localDateOf,
  plannedMinutes,
} from '../utils/staffShiftFormat'
import ShiftStatusBadge from './ShiftStatusBadge'

const NOTE_MAX_LENGTH = 500

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-sm text-on-surface">{children}</dd>
    </div>
  )
}

// What was done to the shift, oldest first (UC38 step 4).
function History({ history }) {
  if (!history?.length) {
    return <p className="text-sm text-on-surface-variant">No history was recorded for this shift.</p>
  }

  return (
    <ol className="space-y-3 border-l border-white/10 pl-4">
      {history.map((entry) => (
        <li key={`${entry.type}-${entry.at}`} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary-container" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">{HISTORY_LABELS[entry.type] ?? entry.type}</p>
          <p className="text-xs text-on-surface-variant">
            {formatDateTime(entry.at)} · {entry.by?.fullName ?? 'Unknown'}
          </p>
          {entry.note && <p className="mt-1 text-xs text-on-surface-variant">“{entry.note}”</p>}
        </li>
      ))}
    </ol>
  )
}

// A mutation that needs a second click: the manager reads the shift above, then approves or cancels.
function ActionPanel({ shift, onDone }) {
  const { account } = useAuth()
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const canManage = account?.permissions?.some(({ name }) => name === 'shift.manage')

  if (shift.status === 'APPROVED') {
    return (
      <section className="rounded-xl border border-secondary/25 bg-secondary/10 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-secondary">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Approved
        </p>
        <p className="mt-1 text-sm text-on-surface">
          Approved by {shift.approval?.approvedBy?.fullName ?? 'a manager'} on {formatDateTime(shift.approval?.approvedAt)}.
        </p>
      </section>
    )
  }

  if (shift.status === 'CANCELLED') {
    return (
      <p className="rounded-xl border border-white/5 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        This shift was cancelled. It stays in the history and cannot be changed.
      </p>
    )
  }

  if (!shift.canApprove && !shift.canCancel) {
    return (
      <p className="rounded-xl border border-white/5 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        This shift is in progress. It can be approved once its planned time has ended.
      </p>
    )
  }

  if (!canManage) {
    return (
      <p className="rounded-xl border border-white/5 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        You do not have permission to change shifts.
      </p>
    )
  }

  const run = async (request, success) => {
    setSubmitting(true)

    try {
      await request()
      toast.success(success)
      onDone()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
      // A 409 means the shift changed meanwhile; show its current state.
      if (error.response?.status === 409) onDone()
    } finally {
      setSubmitting(false)
      setConfirming(null)
    }
  }

  const approve = () => run(() => approveShiftRequest(shift.id, note.trim()), 'Shift approved')
  const cancel = () => run(() => cancelShiftRequest(shift.id), 'Shift cancelled')

  return (
    <section className="space-y-3 rounded-xl border border-white/5 bg-surface-container p-4">
      {shift.canApprove ? (
        <>
          <h3 className="font-heading text-sm font-bold text-on-surface">Approve this shift</h3>
          <label className="block">
            <span className="text-xs text-on-surface-variant">Note (optional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              disabled={submitting}
              placeholder="e.g. Checked against the roster"
              className="mt-1 w-full resize-none rounded-lg border border-transparent bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container/50 focus:ring-2 focus:ring-primary-container/20"
            />
            <span className="block text-right text-[11px] text-on-surface-variant">
              {note.length}/{NOTE_MAX_LENGTH}
            </span>
          </label>
        </>
      ) : (
        <h3 className="font-heading text-sm font-bold text-on-surface">Cancel this shift</h3>
      )}

      {confirming ? (
        <div role="alert" className="space-y-3 rounded-lg bg-surface-container-high p-3">
          <p className="text-sm text-on-surface">
            {confirming === 'approve'
              ? 'Approve this shift? Your name and the time are recorded, and this cannot be undone.'
              : 'Cancel this shift? It stays in the history but can no longer be changed.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirming === 'approve' ? approve : cancel} disabled={submitting} className={primaryButton}>
              {submitting ? 'Saving…' : confirming === 'approve' ? 'Confirm approval' : 'Confirm cancellation'}
            </button>
            <button type="button" onClick={() => setConfirming(null)} disabled={submitting} className={secondaryButton}>
              Back
            </button>
          </div>
        </div>
      ) : shift.canApprove ? (
        <button type="button" onClick={() => setConfirming('approve')} className={primaryButton}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Approve shift
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming('cancel')} className={secondaryButton}>
          <Ban className="size-4" aria-hidden="true" />
          Cancel shift
        </button>
      )}
    </section>
  )
}

function ShiftDetailDrawer({ shiftId, onClose, onChanged }) {
  const [refreshToken, setRefreshToken] = useState(0)
  const { data: shift, loading, error } = useShift(shiftId, refreshToken)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleDone = () => {
    setRefreshToken((token) => token + 1)
    onChanged()
  }

  let body
  if (loading && !shift) {
    body = (
      <div aria-busy="true" aria-label="Loading shift" className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="block h-5 animate-pulse rounded bg-surface-container-high" />
        ))}
      </div>
    )
  } else if (error && !shift) {
    body = (
      <div role="alert" className="space-y-3 text-sm text-on-surface-variant">
        <p>{getApiErrorMessage(error)}</p>
        <button type="button" onClick={() => setRefreshToken((token) => token + 1)} className={secondaryButton}>
          <RefreshCw className="size-4" />
          Try again
        </button>
      </div>
    )
  } else {
    body = (
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Status">
            <ShiftStatusBadge status={shift.status} />
          </Detail>
          <Detail label="Shift date">{formatDateLabel(localDateOf(shift.startTime))}</Detail>
          <Detail label="Planned time">
            {formatTime(shift.startTime)} – {formatTime(shift.endTime)} ({formatMinutes(plannedMinutes(shift))})
          </Detail>
          <Detail label="Work position">{shift.station ?? '—'}</Detail>
          <Detail label="Employee">{shift.employee?.fullName ?? '—'}</Detail>
          <Detail label="Job title">{shift.employee?.position ?? '—'}</Detail>
          <Detail label="Phone">{shift.employee?.phone ?? '—'}</Detail>
        </dl>

        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">History</h3>
          <History history={shift.history} />
        </div>

        <ActionPanel key={shift.status} shift={shift} onDone={handleDone} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close shift details"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shift details"
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/5 bg-surface-container-low shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/5 bg-surface-container-low px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Shift details</p>
            <h2 className="mt-1 truncate font-heading text-xl font-bold text-on-surface">
              {shift?.employee?.fullName ?? 'Loading…'}
            </h2>
            {shift?.station && <p className="truncate text-sm text-on-surface-variant">{shift.station}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 px-5 py-5">{body}</div>
      </aside>
    </div>
  )
}

export default ShiftDetailDrawer
