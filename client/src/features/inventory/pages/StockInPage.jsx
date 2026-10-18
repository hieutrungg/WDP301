import { ArrowLeft, CircleCheck, Minus, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { stockInRequest } from '../api/inventoryApi'
import ReceiptHistory from '../components/ReceiptHistory'
import { useAllStockItems, useSuppliers } from '../hooks/useInventory'
import { validateStockIn } from '../schema/stockInSchema'
import {
  formatQuantity,
  fromDateTimeLocalValue,
  itemLabel,
  toDateTimeLocalValue,
} from '../utils/inventoryFormat'

const fieldClass =
  'w-full rounded-lg border border-transparent bg-surface-container-high px-3 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:ring-2 focus:ring-primary-container/20'
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40'

let lineCounter = 0
const newLine = (concessionId = '') => ({ key: (lineCounter += 1), concessionId, quantity: '' })

function FieldError({ id, message }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-xs text-error">
      {message}
    </p>
  ) : null
}

function StockInLine({ index, line, item, items, takenIds, errors, canRemove, onChange, onRemove }) {
  const quantity = Number(line.quantity)
  const hasQuantity = line.quantity !== '' && Number.isInteger(quantity) && quantity > 0
  const itemError = errors[`items.${index}.concessionId`]
  const quantityError = errors[`items.${index}.quantity`]

  const step = (delta) => {
    const next = Math.max(1, (Number.isInteger(quantity) ? quantity : 0) + delta)
    onChange({ quantity: String(next) })
  }

  return (
    <li className="rounded-xl border border-white/5 bg-surface-container p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-start">
        <div>
          <label htmlFor={`item-${line.key}`} className="mb-1.5 block text-sm font-semibold text-on-surface">
            Item <span className="text-primary-container">*</span>
          </label>
          <select
            id={`item-${line.key}`}
            value={line.concessionId}
            onChange={(event) => onChange({ concessionId: event.target.value })}
            aria-invalid={Boolean(itemError)}
            aria-describedby={itemError ? `item-${line.key}-error` : undefined}
            className={`${fieldClass} h-11`}
          >
            <option value="">Select an item…</option>
            {items.map((option) => (
              <option key={option.id} value={option.id} disabled={takenIds.has(option.id) && option.id !== line.concessionId}>
                {itemLabel(option)}
              </option>
            ))}
          </select>
          <FieldError id={`item-${line.key}-error`} message={itemError} />
          {item && (
            <p className="mt-1.5 text-xs text-on-surface-variant">
              Current stock: <strong className="text-on-surface">{formatQuantity(item.quantity)}</strong> {item.unit}
              {hasQuantity && (
                <>
                  {' '}→ after receipt: <strong className="text-secondary">{formatQuantity(item.quantity + quantity)}</strong> {item.unit}
                </>
              )}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`qty-${line.key}`} className="mb-1.5 block text-sm font-semibold text-on-surface">
            Quantity received <span className="text-primary-container">*</span>
          </label>
          <div className="flex items-center gap-1 rounded-lg bg-surface-container-high p-1">
            <button type="button" onClick={() => step(-1)} aria-label="Decrease quantity" className="grid size-10 place-items-center rounded-md bg-surface-container text-on-surface transition-colors hover:bg-surface-bright">
              <Minus className="size-4" />
            </button>
            <input
              id={`qty-${line.key}`}
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={line.quantity}
              onChange={(event) => onChange({ quantity: event.target.value })}
              aria-invalid={Boolean(quantityError)}
              aria-describedby={quantityError ? `qty-${line.key}-error` : undefined}
              placeholder="0"
              className="h-10 w-full min-w-0 bg-transparent text-center font-heading text-lg font-extrabold text-secondary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => step(1)} aria-label="Increase quantity" className="grid size-10 place-items-center rounded-md bg-surface-container text-on-surface transition-colors hover:bg-surface-bright">
              <Plus className="size-4" />
            </button>
          </div>
          <FieldError id={`qty-${line.key}-error`} message={quantityError} />
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove item ${index + 1}`}
          className="mt-0 grid size-10 place-items-center self-end rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-error disabled:pointer-events-none disabled:opacity-30 md:mt-7"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}

// UC40 Stock Goods. Several items can be received in one confirmed receipt; the server applies
// all of them or none (BR-50: stock only changes once the receipt is confirmed).
function StockInPage({ backPath }) {
  const [searchParams] = useSearchParams()
  const presetItemId = /^[a-f\d]{24}$/i.test(searchParams.get('itemId') ?? '') ? searchParams.get('itemId') : ''

  const [refreshToken, setRefreshToken] = useState(0)
  const items = useAllStockItems(refreshToken)
  const suppliers = useSuppliers()

  const [lines, setLines] = useState(() => [newLine(presetItemId)])
  const [supplierId, setSupplierId] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => toDateTimeLocalValue())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const submittingRef = useRef(false)

  const itemList = items.data ?? []
  const itemsById = new Map(itemList.map((item) => [item.id, item]))
  const takenIds = new Set(lines.map(({ concessionId }) => concessionId).filter(Boolean))

  const updateLine = (key, changes) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)))
    setErrors({})
  }

  const reset = () => {
    setLines([newLine()])
    setSupplierId('')
    setReceivedAt(toDateTimeLocalValue())
    setNote('')
    setErrors({})
    setFormError('')
    setReceipt(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    // A ref, not only state: a fast double click must not send the receipt twice.
    if (submittingRef.current) return

    const result = validateStockIn({ lines, receivedAt, note })
    if (result.errors) {
      setErrors(result.errors)
      setFormError('Please correct the highlighted fields.')
      return
    }

    const receivedIso = fromDateTimeLocalValue(receivedAt)
    if (!receivedIso) {
      setErrors({ receivedAt: 'Enter a valid date and time' })
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setErrors({})
    setFormError('')

    try {
      const saved = await stockInRequest({
        items: lines.map(({ concessionId, quantity }) => ({ concessionId, quantity: Number(quantity) })),
        ...(supplierId ? { supplierId } : {}),
        receivedAt: receivedIso,
        ...(note.trim() ? { note: note.trim() } : {}),
      })

      setReceipt(saved)
      setRefreshToken((token) => token + 1)
      toast.success('Stock updated', { description: `Receipt ${saved.receiptCode} was recorded.` })
    } catch (error) {
      // UC40 alternative sequences: show the problem and keep the form so nothing is retyped.
      const fieldErrors = Object.fromEntries(
        getApiFieldErrors(error).map(({ field, message }) => [field, message]),
      )
      setErrors(fieldErrors)
      setFormError(getApiErrorMessage(error))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section role="status" className="rounded-2xl border border-secondary/25 bg-secondary/5 p-6">
          <p className="flex items-center gap-2 font-heading text-xl font-bold text-secondary">
            <CircleCheck className="size-6" aria-hidden="true" />
            Stock updated successfully
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Receipt <strong className="text-on-surface">{receipt.receiptCode}</strong> was recorded and the new
            quantities are live.
          </p>
          <ul className="mt-4 divide-y divide-white/5 rounded-xl bg-surface-container">
            {receipt.items.map((line) => (
              <li key={line.concessionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-on-surface">{line.name}</span>
                <span className="text-on-surface-variant">
                  <strong className="text-secondary">+{formatQuantity(line.quantityAdded)}</strong> → now{' '}
                  <strong className="text-on-surface">{formatQuantity(line.quantityAfter)}</strong>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={reset} className={secondaryButton}>
              <PackagePlus className="size-4" />
              Receive more goods
            </button>
            <Link to={backPath} className={secondaryButton}>
              <ArrowLeft className="size-4" />
              Back to stock levels
            </Link>
          </div>
        </section>
        <ReceiptHistory refreshToken={refreshToken} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section>
        <Link to={backPath} className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface">
          <ArrowLeft className="size-4" />
          Concession stock levels
        </Link>
        <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-on-surface sm:text-[32px] sm:leading-10">
          Stock Goods
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
          Record goods received at your branch. Stock quantities change only when you confirm the
          receipt, and every receipt is saved in the inventory history.
        </p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-surface-container-low p-5 sm:p-6">
        {formError && (
          <p role="alert" className="rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
            {formError}
          </p>
        )}

        <fieldset className="space-y-3">
          <legend className="font-heading text-base font-bold text-on-surface">Items received</legend>
          {items.loading && !items.data ? (
            <p aria-busy="true" className="rounded-xl bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
              Loading items…
            </p>
          ) : items.error && !items.data ? (
            <p role="alert" className="rounded-xl bg-error-container/20 px-4 py-6 text-center text-sm text-on-error-container">
              {getApiErrorMessage(items.error)}{' '}
              <button type="button" onClick={() => setRefreshToken((token) => token + 1)} className="font-semibold underline">
                Retry
              </button>
            </p>
          ) : itemList.length === 0 ? (
            // UC40 alternative sequence at step 4: the goods do not exist yet.
            <p className="rounded-xl bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
              No concession items exist yet. Ask your branch manager or an admin to create the item first.
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {lines.map((line, index) => (
                  <StockInLine
                    key={line.key}
                    index={index}
                    line={line}
                    item={itemsById.get(line.concessionId)}
                    items={itemList}
                    takenIds={takenIds}
                    errors={errors}
                    canRemove={lines.length > 1}
                    onChange={(changes) => updateLine(line.key, changes)}
                    onRemove={() => setLines((current) => current.filter(({ key }) => key !== line.key))}
                  />
                ))}
              </ul>
              <FieldError message={errors.items} />
              <button
                type="button"
                onClick={() => setLines((current) => [...current, newLine()])}
                disabled={lines.length >= 50 || lines.length >= itemList.length}
                className={secondaryButton}
              >
                <Plus className="size-4" />
                Add another item
              </button>
            </>
          )}
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="supplier" className="mb-1.5 block text-sm font-semibold text-on-surface">
              Supplier <span className="font-normal text-on-surface-variant">(optional)</span>
            </label>
            <select id="supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={`${fieldClass} h-11`}>
              <option value="">No supplier</option>
              {(suppliers.data ?? []).map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            {suppliers.error && <p className="mt-1 text-xs text-error">Suppliers could not be loaded; you can still record the receipt without one.</p>}
            <FieldError message={errors.supplierId} />
          </div>

          <div>
            <label htmlFor="received-at" className="mb-1.5 block text-sm font-semibold text-on-surface">
              Received date and time <span className="text-primary-container">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="received-at"
                type="datetime-local"
                value={receivedAt}
                max={toDateTimeLocalValue()}
                onChange={(event) => setReceivedAt(event.target.value)}
                aria-invalid={Boolean(errors.receivedAt)}
                className={`${fieldClass} h-11`}
              />
              <button type="button" onClick={() => setReceivedAt(toDateTimeLocalValue())} className={`${secondaryButton} shrink-0 px-3 text-xs`}>
                Now
              </button>
            </div>
            <FieldError message={errors.receivedAt} />
          </div>
        </div>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-sm font-semibold text-on-surface">
            Note <span className="font-normal text-on-surface-variant">(optional)</span>
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Delivery reference, condition of goods…"
            className={`${fieldClass} resize-none py-2.5`}
          />
          <FieldError message={errors.note} />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link to={backPath} className={secondaryButton}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || itemList.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-6 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            <CircleCheck className="size-4" />
            {submitting ? 'Updating stock…' : 'Confirm stock receipt'}
          </button>
        </div>
      </form>

      <ReceiptHistory refreshToken={refreshToken} />
    </div>
  )
}

export default StockInPage
