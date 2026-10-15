import { Check, X } from 'lucide-react'
import { passwordRules } from '../schema/accountSchemas'

const levels = {
  empty: { filled: 0, bar: '', text: 'text-tertiary', dot: 'bg-surface-bright' },
  weak: { filled: 1, bar: 'bg-error', text: 'text-error', dot: 'bg-error animate-pulse' },
  fair: { filled: 2, bar: 'bg-secondary', text: 'text-secondary', dot: 'bg-secondary' },
  strong: { filled: 3, bar: 'bg-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500' },
}

const describe = (value) => {
  if (!value) return { level: 'empty', label: 'Not set' }

  const missing = passwordRules.filter((rule) => !rule.test(value))
  if (missing.length === 0) return { level: 'strong', label: 'Strong' }

  const needs = `needs ${missing.map((rule) => rule.short).join(' & ')}`
  return missing.length >= 2
    ? { level: 'weak', label: `Weak — ${needs}` }
    : { level: 'fair', label: `Fair — ${needs}` }
}

function RequirementIcon({ state }) {
  if (state === 'met') {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500/20">
        <Check className="size-3 text-emerald-500" strokeWidth={3} />
      </span>
    )
  }

  if (state === 'failed') {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-error/20">
        <X className="size-3 text-error" strokeWidth={3} />
      </span>
    )
  }

  return <span className="size-4 shrink-0 rounded-full bg-surface-bright" />
}

// `compact` keeps the checklist in one column for narrow cards such as the auth pages.
function PasswordStrength({ value = '', compact = false }) {
  const { level, label } = describe(value)
  const style = levels[level]

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl bg-surface-container/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-tertiary">Strength Indicator</span>
        <span
          className={`flex items-center gap-1 text-right text-[11px] leading-[14px] font-semibold tracking-wider uppercase ${style.text}`}
        >
          <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
          {label}
        </span>
      </div>

      <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-surface-container-highest">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-full w-1/3 rounded-full ${index < style.filled ? style.bar : 'bg-surface-bright'}`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <h5 className="font-heading text-xs font-bold tracking-wider text-tertiary uppercase">
          Password Requirements
        </h5>
        <ul className={`grid grid-cols-1 gap-2 text-xs ${compact ? '' : 'sm:grid-cols-2'}`}>
          {passwordRules.map((rule) => {
            const state = !value ? 'pending' : rule.test(value) ? 'met' : 'failed'

            return (
              <li
                key={rule.id}
                className={`flex items-center gap-2 ${rule.id === 'special' && !compact ? 'sm:col-span-2' : ''}`}
              >
                <RequirementIcon state={state} />
                <span
                  className={
                    state === 'met'
                      ? 'text-on-surface'
                      : state === 'failed'
                        ? 'font-medium text-error/90'
                        : 'text-tertiary'
                  }
                >
                  {rule.label}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default PasswordStrength
