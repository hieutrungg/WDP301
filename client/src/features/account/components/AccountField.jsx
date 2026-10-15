// Shared building blocks for the account form pages (Edit Profile, Change Password).

export const errorRingClass =
  'text-error shadow-[0_0_0_1.5px_#e50914,0_0_16px_rgba(229,9,20,0.35)]'

export function FieldLabel({ htmlFor, required = false, muted = false, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`flex items-center gap-1 font-heading text-sm font-semibold ${muted ? 'text-tertiary' : 'text-on-surface'}`}
    >
      {children}
      {required && <span className="text-primary-container">*</span>}
    </label>
  )
}

export function FieldBadge({ icon: Icon, tone = 'muted', children }) {
  const toneClass =
    tone === 'secondary'
      ? 'bg-secondary/15 text-secondary'
      : 'bg-surface-container-highest text-tertiary'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-[14px] font-bold tracking-wider uppercase ${toneClass}`}
    >
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  )
}

export function FieldMessage({ icon: Icon, id, children }) {
  if (!children) return null

  return (
    <p id={id} role="alert" className="mt-0.5 flex items-start gap-1.5 text-xs font-semibold text-error">
      {Icon && <Icon className="mt-px size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}
