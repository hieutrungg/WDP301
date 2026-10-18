import { PackagePlus } from 'lucide-react'
import { Link } from 'react-router'
import { formatQuantity, itemLabel } from '../utils/inventoryFormat'
import StockStatusBadge from './StockStatusBadge'

const rowTone = {
  OUT_OF_STOCK: 'bg-error-container/10',
  LOW_STOCK: 'bg-secondary/5',
  IN_STOCK: '',
}

const quantityTone = {
  OUT_OF_STOCK: 'text-error',
  LOW_STOCK: 'text-secondary',
  IN_STOCK: 'text-on-surface',
}

const headClass = 'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant'

function StockLevelTable({ items, restockPath }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-surface-container-high/60">
          <tr>
            <th scope="col" className={headClass}>Item</th>
            <th scope="col" className={headClass}>Category</th>
            <th scope="col" className={`${headClass} text-right`}>Current quantity</th>
            <th scope="col" className={headClass}>Unit</th>
            <th scope="col" className={`${headClass} text-right`}>Min. threshold</th>
            <th scope="col" className={headClass}>Status</th>
            {restockPath && <th scope="col" className={`${headClass} text-right`}><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`border-t border-white/5 ${rowTone[item.stockStatus] ?? ''}`}>
              <td className="px-4 py-3.5 font-semibold text-on-surface">{itemLabel(item)}</td>
              <td className="px-4 py-3.5 text-on-surface-variant">{item.category?.name ?? '—'}</td>
              <td className={`px-4 py-3.5 text-right font-heading text-base font-extrabold tabular-nums ${quantityTone[item.stockStatus] ?? ''}`}>
                {formatQuantity(item.quantity)}
              </td>
              <td className="px-4 py-3.5 text-on-surface-variant">{item.unit}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-on-surface-variant">{formatQuantity(item.minThreshold)}</td>
              <td className="px-4 py-3.5"><StockStatusBadge status={item.stockStatus} /></td>
              {restockPath && (
                <td className="px-4 py-3.5 text-right">
                  {item.stockStatus !== 'IN_STOCK' && (
                    <Link
                      to={`${restockPath}?itemId=${item.id}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest"
                    >
                      <PackagePlus className="size-3.5" aria-hidden="true" />
                      Restock
                    </Link>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StockLevelTable
