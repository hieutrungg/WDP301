import { Building2, Eye, EyeOff, MonitorPlay } from 'lucide-react'

function SummaryCard({ label, icon: Icon, value, caption, loading, accent = 'text-on-surface' }) {
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
    </div>
  )
}

function BranchSummaryCards({ summary, loading, error }) {
  const show = (value) => (error && !summary ? '—' : (value ?? 0))
  const isLoading = loading && !summary

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        label="Total branches"
        icon={Building2}
        value={show(summary?.total)}
        caption="All lifecycle states"
        loading={isLoading}
      />
      <SummaryCard
        label="Active"
        icon={Eye}
        value={show(summary?.active)}
        caption="Shown in public discovery"
        loading={isLoading}
        accent="text-secondary"
      />
      <SummaryCard
        label="Inactive"
        icon={EyeOff}
        value={show(summary?.inactive)}
        caption="Retired, history kept"
        loading={isLoading}
      />
      <SummaryCard
        label="Rooms"
        icon={MonitorPlay}
        value={show(summary?.roomCount)}
        caption="Configured across branches"
        loading={isLoading}
      />
    </div>
  )
}

export default BranchSummaryCards
