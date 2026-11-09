import { Check, Loader2, ShieldCheck, X } from 'lucide-react'
import { formatActionExpiry } from '../utils/aiMessage'

const RESULT_STYLE = {
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  failed: 'border-primary/40 bg-primary-container/15 text-on-surface',
  cancelled: 'border-white/10 bg-surface-container text-on-surface-variant',
}

// A write tool's proposal. Nothing has changed until the user presses Xác nhận.
function PendingActionCard({ action, onConfirm, onCancel }) {
  const settled = ['done', 'failed', 'cancelled'].includes(action.state)
  const working = action.state === 'working'

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-surface-container-high p-3 text-xs">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-on-surface">Cần bạn xác nhận</p>
          <p className="mt-0.5 text-on-surface-variant">{action.summary}</p>
        </div>
      </div>
      {settled ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 ${RESULT_STYLE[action.state]}`} role="status">{action.message}</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" disabled={working} onClick={() => onConfirm(action.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 font-bold text-white disabled:opacity-50">
            {working ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
            Xác nhận
          </button>
          <button type="button" disabled={working} onClick={() => onCancel(action.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1.5 text-on-surface-variant hover:text-white disabled:opacity-50">
            <X className="size-3.5" aria-hidden="true" />
            Huỷ
          </button>
          <span className="ml-auto text-[10px] text-on-surface-variant">{formatActionExpiry(action.expiresAt)}</span>
        </div>
      )}
    </div>
  )
}

export default PendingActionCard
