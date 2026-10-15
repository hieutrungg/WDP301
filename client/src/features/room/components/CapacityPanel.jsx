import { ChartColumn } from 'lucide-react'

const percent = (value, total) => (total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—')

function Row({ dot, label, value, share, note }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`size-2.5 shrink-0 ${dot}`} aria-hidden="true" />
        <span className="truncate text-on-surface">{label}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="font-bold text-on-surface">{value}</span>
        <span className="w-12 text-right text-[11px] text-on-surface-variant">{share ?? note}</span>
      </span>
    </div>
  )
}

function CapacityPanel({ summary, dirty }) {
  const capacity = summary.operationalSeatCapacity

  return (
    <section className="grid gap-4 rounded-2xl border border-white/5 bg-surface-container-low p-5" aria-label="Capacity">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-on-surface">Capacity matrix</h2>
        <ChartColumn className="size-5 text-tertiary" aria-hidden="true" />
      </div>

      <div className="flex items-end justify-between gap-3 rounded-xl bg-surface-container p-4">
        <div>
          <p className="text-xs text-on-surface-variant">Operational seat capacity</p>
          <p className="font-heading text-4xl font-extrabold leading-tight text-on-surface" aria-live="polite">
            {capacity}
            <span className="ml-1.5 text-sm font-normal text-on-surface-variant">seats</span>
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${dirty ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-highest text-tertiary'}`}
        >
          {dirty ? 'Live preview' : 'Saved'}
        </span>
      </div>

      <div className="grid gap-2.5">
        <Row dot="rounded-sm bg-surface-container-highest ring-1 ring-tertiary/50" label="Standard" value={summary.standardCount} share={percent(summary.standardCount, capacity)} />
        <Row dot="rounded-sm bg-secondary" label="VIP" value={summary.vipCount} share={percent(summary.vipCount, capacity)} />
        <Row dot="rounded-full bg-primary-container" label="Double Luxury" value={summary.doubleLuxuryCount} share={percent(summary.doubleLuxuryCount, capacity)} />
        <Row dot="rounded-full bg-blue-500" label="Accessible (within tiers)" value={summary.accessibleCount} share={percent(summary.accessibleCount, capacity)} />
      </div>

      <div className="h-px bg-white/5" />

      <div className="grid gap-2.5">
        <Row dot="rounded-sm bg-tertiary-container" label="Blocked seats" value={summary.disabledCount} note="excluded" />
        <Row dot="rounded-sm border border-dashed border-white/40" label="Aisle positions" value={summary.aisleCount} note="excluded" />
        <p className="text-[11px] leading-5 text-on-surface-variant">
          {summary.rowCount} rows × {summary.columnCount} columns = {summary.totalPositions} positions.
          Capacity counts enabled seats only; the server recalculates it on save.
        </p>
      </div>
    </section>
  )
}

export default CapacityPanel
