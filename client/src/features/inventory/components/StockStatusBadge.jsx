const statusStyles = {
  OUT_OF_STOCK: {
    label: 'Out of stock',
    badge: 'bg-error-container/30 text-error ring-error/30',
    dot: 'bg-error',
  },
  LOW_STOCK: {
    label: 'Low stock',
    badge: 'bg-secondary/10 text-secondary ring-secondary/25',
    dot: 'bg-secondary',
  },
  IN_STOCK: {
    label: 'In stock',
    badge: 'bg-surface-container-highest text-tertiary ring-white/10',
    dot: 'bg-tertiary',
  },
}

function StockStatusBadge({ status }) {
  const style = statusStyles[status] ?? statusStyles.IN_STOCK

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

export default StockStatusBadge
