import { Lock } from 'lucide-react'
import { actorRoleOf } from '../utils/accessControl'

// UC35 step 5 / UC37 step 3: exactly one role per staff account (radio). `value` stays an array of
// role ids for the API. A locked role (an Admin's own ADMIN role) cannot be switched away from.
function RolePicker({ roles, value, onChange, error, lockedIds = [], disabled = false }) {
  const lockedSelection = value.some((id) => lockedIds.includes(id))

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Role" aria-describedby={error ? 'roles-error' : undefined}>
        {roles.map((role) => {
          const checked = value.includes(role.id)
          const locked = lockedIds.includes(role.id) || (lockedSelection && !checked)

          return (
            <label
              key={role.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary-container/50 bg-primary-container/10' : 'border-white/5 bg-surface-container hover:bg-surface-container-high'} ${locked || disabled ? 'cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="staff-role"
                checked={checked}
                disabled={disabled || locked}
                onChange={() => onChange([role.id])}
                className="mt-1 size-4 accent-primary-container"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                  {role.name}
                  {/* Scope of the role: ADMIN works system-wide; STAFF and MANAGER (and custom roles
                      built on them) work at one cinema branch. */}
                  <span className="rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {actorRoleOf(role) === 'ADMIN' ? 'System' : 'Branch'}
                  </span>
                  {lockedIds.includes(role.id) && (
                    <Lock className="size-3.5 text-on-surface-variant" aria-label="Your own Admin role" />
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id="roles-error" className="mt-1.5 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

export default RolePicker
