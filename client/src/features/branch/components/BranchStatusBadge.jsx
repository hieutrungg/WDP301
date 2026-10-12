const statusStyles = {
  ACTIVE: {
    label: 'Active',
    hint: 'Visible to customers',
    badge: 'bg-secondary/10 text-secondary ring-secondary/25',
    dot: 'bg-secondary',
  },
  INACTIVE: {
    label: 'Inactive',
    hint: 'Hidden from customers and new showtimes',
    badge: 'bg-surface-container-highest text-tertiary ring-white/10',
    dot: 'bg-tertiary-container',
  },
}

function BranchStatusBadge({ status, showHint = false }) {
  const style = statusStyles[status] ?? statusStyles.INACTIVE

  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${style.badge}`}
      >
        <span className={`size-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>
      {showHint && <p className="mt-1.5 text-xs text-on-surface-variant">{style.hint}</p>}
    </div>
  )
}

export default BranchStatusBadge
