import { Lock } from 'lucide-react'
import { toggleId } from '../utils/accessControl'

// UC35 step 5 / UC37 step 3: one or more roles. `lockedIds` cannot be unticked (an Admin's own
// ADMIN role).
function RolePicker({ roles, value, onChange, error, lockedIds = [], disabled = false }) {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Roles" aria-describedby={error ? 'roles-error' : undefined}>
        {roles.map((role) => {
          const checked = value.includes(role.id)
          const locked = lockedIds.includes(role.id)

          return (
            <label
              key={role.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary-container/50 bg-primary-container/10' : 'border-white/5 bg-surface-container hover:bg-surface-container-high'} ${locked || disabled ? 'cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || locked}
                onChange={() => onChange(toggleId(value, role.id))}
                className="mt-1 size-4 accent-primary-container"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                  {role.name}
                  {role.isSystem && (
                    <span className="rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                      System
                    </span>
                  )}
                  {locked && <Lock className="size-3.5 text-on-surface-variant" aria-label="Your own Admin role" />}
                </span>
                <span className="block text-xs text-on-surface-variant">
                  {role.description || 'No description'} · {role.permissionIds.length} permissions
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
