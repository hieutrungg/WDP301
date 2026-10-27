export const inputClass =
  'w-full rounded-lg border border-transparent bg-surface-container px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 aria-[invalid=true]:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-not-allowed read-only:opacity-70'

// Label, Required/Optional chip and the CR-04 error shown next to the field.
function FormField({ id, label, hint, required, icon: Icon, error, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-on-surface">
          {label}
        </label>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${required ? 'bg-primary-container/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-on-surface-variant" />}
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-300">
          {error.message ?? error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>
      )}
    </div>
  )
}

export default FormField
