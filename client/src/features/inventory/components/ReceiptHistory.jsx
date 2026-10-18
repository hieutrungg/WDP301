import { History, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useStockInHistory } from '../hooks/useInventory'
import { formatDateTime, formatQuantity } from '../utils/inventoryFormat'
import Pagination from './Pagination'

const PAGE_SIZE = 5
const headClass = 'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant'

// UC40 step 10 made visible: the inventory history of goods received at this branch.
function ReceiptHistory({ refreshToken }) {
  const [page, setPage] = useState(1)
  const history = useStockInHistory({ page, limit: PAGE_SIZE, refreshToken })
  const rows = history.data?.items ?? []

  let content
  if (history.loading && !history.data) {
    content = <p className="px-5 py-8 text-center text-sm text-on-surface-variant" aria-busy="true">Loading receipts…</p>
  } else if (history.error && !history.data) {
    content = (
      <p role="alert" className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-on-error-container">
        <RefreshCw className="size-4" aria-hidden="true" />
        {getApiErrorMessage(history.error)}
      </p>
    )
  } else if (rows.length === 0) {
    content = <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No goods have been received at this branch yet.</p>
  } else {
    content = (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-surface-container-high/60">
            <tr>
              <th scope="col" className={headClass}>Receipt</th>
              <th scope="col" className={headClass}>Item</th>
              <th scope="col" className={headClass}>Supplier</th>
              <th scope="col" className={`${headClass} text-right`}>Quantity</th>
              <th scope="col" className={headClass}>Received</th>
              <th scope="col" className={headClass}>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-semibold text-secondary">{row.receiptCode ?? '—'}</td>
                <td className="px-4 py-3 text-on-surface">{row.concession?.name ?? 'Unknown item'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{row.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-secondary">
                  +{formatQuantity(row.quantity)} {row.concession?.unit}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{formatDateTime(row.receivedAt)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{row.recordedBy?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section
      aria-label="Recent goods receipts"
      className={`overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low transition-opacity ${history.loading && history.data ? 'opacity-60' : ''}`}
    >
      <h2 className="flex items-center gap-2 px-5 py-4 font-heading text-base font-bold text-on-surface">
        <History className="size-5 text-secondary" aria-hidden="true" />
        Recent goods receipts
      </h2>
      {content}
      <Pagination meta={history.data?.meta} noun="receipt lines" loading={history.loading} onPageChange={setPage} />
    </section>
  )
}

export default ReceiptHistory
