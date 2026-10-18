import { Ban, CircleAlert, PackageCheck, Boxes } from 'lucide-react'

function SummaryCard({ label, icon: Icon, value, caption, loading, accent = 'text-on-surface' }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-4">
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
    </div>
  )
}

export function StockSummaryCards({ summary, loading, error }) {
  const show = (value) => (error && !summary ? '—' : (value ?? 0))
  const isLoading = loading && !summary

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard label="Total items" icon={Boxes} value={show(summary?.total)} caption="Active concession items" loading={isLoading} />
      <SummaryCard label="In stock" icon={PackageCheck} value={show(summary?.inStock)} caption="Above the minimum threshold" loading={isLoading} />
      <SummaryCard label="Low stock" icon={CircleAlert} value={show(summary?.lowStock)} caption="At or below the threshold" loading={isLoading} accent="text-secondary" />
      <SummaryCard label="Out of stock" icon={Ban} value={show(summary?.outOfStock)} caption="Quantity is zero" loading={isLoading} accent="text-error" />
    </div>
  )
}

// UC39 steps 5-6 and the alternatives: an alert only exists when there is something to flag.
export function StockAlerts({ summary }) {
  if (!summary || (summary.outOfStock === 0 && summary.lowStock === 0)) return null

  return (
    <div className="grid gap-2" role="status">
      {summary.outOfStock > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
          <Ban className="size-4 shrink-0" aria-hidden="true" />
          {summary.outOfStock} {summary.outOfStock === 1 ? 'item is' : 'items are'} out of stock and need restocking.
        </p>
      )}
      {summary.lowStock > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-secondary/25 bg-secondary/10 px-4 py-3 text-sm text-secondary">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {summary.lowStock} {summary.lowStock === 1 ? 'item is' : 'items are'} at or below the minimum stock threshold.
        </p>
      )}
    </div>
  )
}
