import { Eye, EyeOff } from 'lucide-react'

export function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-red-300">{message}</p>
}

export function AuthInput({ id, label, icon: Icon, error, className = '', ...inputProps }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" />}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          className={`h-12 w-full rounded-lg border border-transparent bg-surface-container pr-4 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 ${Icon ? 'pl-11' : 'pl-4'}`}
          {...inputProps}
        />
      </div>
      <FieldError message={error?.message} />
    </div>
  )
}

export function PasswordInput({ id, label, labelAction, icon: Icon, error, visible, onToggle, ...inputProps }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-on-surface">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" />}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          className="h-12 w-full rounded-lg border border-transparent bg-surface-container pl-11 pr-11 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20"
          {...inputProps}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant transition hover:text-white"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      <FieldError message={error?.message} />
    </div>
  )
}

export function AuthServerError({ message }) {
  if (!message) return null

  return (
    <div role="alert" className="mb-5 rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
      {message}
    </div>
  )
}
