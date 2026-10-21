import { CalendarPlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { createShiftRequest } from '../api/staffShiftApi'
import { useEmployees, useStations } from '../hooks/useStaffShifts'
import { STATION_MAX_LENGTH, validateAssignShift } from '../schema/assignShiftSchema'
import { toLocalDateTimeInput } from '../utils/staffShiftFormat'

const SEARCH_DEBOUNCE_MS = 300
const HOUR_MS = 60 * 60 * 1000
const DEFAULT_SHIFT_HOURS = 8

const inputClass =
  'h-11 w-full rounded-lg border border-transparent bg-surface-container px-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/60 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 [color-scheme:dark]'

// Next full hour at least 30 minutes away, and the default length after it.
const defaultWindow = () => {
  const start = new Date(Math.ceil((Date.now() + 30 * 60 * 1000) / HOUR_MS) * HOUR_MS)
  return {
    startTime: toLocalDateTimeInput(start),
    endTime: toLocalDateTimeInput(new Date(start.getTime() + DEFAULT_SHIFT_HOURS * HOUR_MS)),
  }
}

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-error">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-on-surface-variant/80">{hint}</span>
      )}
    </label>
  )
}

// Manager assigns a shift to a staff account: who, where (work position) and when. This plans a
// shift; it does not record attendance. The shift goes to the Manager's own branch.
function AssignShiftDrawer({ branchName, onClose, onCreated }) {
  const [values, setValues] = useState(() => ({ employeeAccountId: '', station: '', ...defaultWindow() }))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const closeRef = useRef(null)
  const employees = useEmployees(query)
  const stations = useStations(0)

  useEffect(() => {
    closeRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (search.trim() === query) return undefined
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, query])

  const update = (changes) => {
    setValues((previous) => ({ ...previous, ...changes }))
    setErrors((previous) => {
      const next = { ...previous }
      for (const key of Object.keys(changes)) delete next[key]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const result = validateAssignShift(values)

    if (result.errors) {
      setErrors(result.errors)
      return
    }

    setSubmitting(true)

    try {
      await createShiftRequest(result.value)
      toast.success('Shift assigned')
      onCreated()
    } catch (error) {
      const fieldErrors = Object.fromEntries(getApiFieldErrors(error).map(({ field, message }) => [field, message]))

      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
      else toast.error(getApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const employeeOptions = employees.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close assign shift"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Assign shift"
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/5 bg-surface-container-low shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/5 bg-surface-container-low px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{branchName ?? 'Your branch'}</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-on-surface">Assign shift</h2>
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

        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 px-5 py-5">
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-on-surface-variant">Find an employee</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name"
                maxLength={100}
                className={`${inputClass} mt-1`}
              />
            </label>
            <Field label="Employee" error={errors.employeeAccountId} hint="Active staff who work at your branch">
              <select
                value={values.employeeAccountId}
                onChange={(event) => update({ employeeAccountId: event.target.value })}
                className={inputClass}
              >
                <option value="">{employees.loading && !employees.data ? 'Loading…' : 'Select an employee'}</option>
                {employeeOptions.map(({ id, fullName, position, phone }) => (
                  <option key={id} value={id}>
                    {[fullName, position, phone].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </Field>
            {employees.error && <p role="alert" className="text-xs text-error">{getApiErrorMessage(employees.error)}</p>}
            {!employees.loading && !employees.error && employeeOptions.length === 0 && (
              <p className="text-xs text-on-surface-variant">No staff account matches this search.</p>
            )}
          </div>

          <Field label="Work position" error={errors.station} hint="For example Box Office Station 2">
            <input
              type="text"
              list="shift-station-options"
              value={values.station}
              onChange={(event) => update({ station: event.target.value })}
              maxLength={STATION_MAX_LENGTH}
              placeholder="Work position"
              className={inputClass}
            />
            <datalist id="shift-station-options">
              {(stations.data ?? []).map((station) => (
                <option key={station} value={station} />
              ))}
            </datalist>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts (cinema time)" error={errors.startTime}>
              <input
                type="datetime-local"
                value={values.startTime}
                onChange={(event) => update({ startTime: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Ends (cinema time)" error={errors.endTime} hint="At most 12 hours">
              <input
                type="datetime-local"
                value={values.endTime}
                onChange={(event) => update({ endTime: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {submitting ? 'Assigning…' : 'Assign shift'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default AssignShiftDrawer
