import { CheckSquare, Info, Search, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { groupPermissions, redundancyLabel, toggleId } from '../utils/accessControl'

// Picks from the predefined permission list only (BR-33). `inherited` (permissionId -> role
// names) marks grants a selected role already provides (UC37 4a): they show as ticked and locked,
// because the role grants them; only a redundant direct grant of the same permission can be
// unticked. `value` holds the direct grants only, so role changes keep applying (BR-34).
function PermissionPicker({ permissions, value, onChange, inherited, disabled = false, emptyHint, idPrefix = 'permission' }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => groupPermissions(permissions, query), [permissions, query])
  const selected = new Set(value)
  const fromRole = (id) => (inherited?.get(id)?.length ?? 0) > 0
  const granted = (id) => selected.has(id) || fromRole(id)
  const grantedCount = permissions.filter(({ id }) => granted(id)).length

  const setGroup = (groupPermissionIds, checked) => {
    const next = new Set(value)
    // Role grants are not copied into direct grants.
    for (const id of groupPermissionIds.filter((permissionId) => !fromRole(permissionId))) {
      if (checked) next.add(id)
      else next.delete(id)
    }
    onChange([...next])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search permissions</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search permissions"
            className="h-10 w-full rounded-lg bg-surface-container pl-9 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary-container/30"
          />
        </label>
        <p className="shrink-0 text-xs font-semibold text-on-surface-variant">
          {inherited
            ? `${grantedCount} of ${permissions.length} granted (${value.length} direct)`
            : `${value.length} of ${permissions.length} selected`}
        </p>
      </div>

      {grantedCount === 0 && emptyHint && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          {emptyHint}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="rounded-lg bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
          No permissions match your search.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const ids = group.permissions.map(({ id }) => id)
            const allChecked = ids.every(granted)
            const allFromRole = ids.every((id) => fromRole(id) && !selected.has(id))

            return (
              <fieldset key={group.group} className="rounded-xl border border-white/5 bg-surface-container/60">
                <legend className="sr-only">{group.label}</legend>
                <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{group.label}</p>
                  <button
                    type="button"
                    disabled={disabled || allFromRole}
                    onClick={() => setGroup(ids, !allChecked)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-white disabled:opacity-40"
                  >
                    {allChecked ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                    {allChecked ? 'Clear group' : 'Select group'}
                  </button>
                </div>
                <ul className="divide-y divide-white/5">
                  {group.permissions.map((permission) => {
                    const inputId = `${idPrefix}-${permission.id}`
                    const roleNames = inherited?.get(permission.id) ?? []
                    const isDirect = selected.has(permission.id)
                    const isChecked = isDirect || roleNames.length > 0
                    // Granted by a role only: shown ticked, cannot be unticked here.
                    const lockedByRole = roleNames.length > 0 && !isDirect

                    return (
                      <li key={permission.id}>
                        <label
                          htmlFor={inputId}
                          className={`flex items-start gap-3 px-4 py-2.5 ${lockedByRole ? 'cursor-default' : 'cursor-pointer hover:bg-surface-container-high/50'}`}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled || lockedByRole}
                            onChange={() => onChange(toggleId(value, permission.id))}
                            className="mt-1 size-4 accent-primary-container"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-[13px] text-on-surface">{permission.name}</span>
                            {permission.description && (
                              <span className="block text-xs text-on-surface-variant">{permission.description}</span>
                            )}
                            {roleNames.length > 0 && (
                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isDirect ? 'bg-amber-400/15 text-amber-200' : 'bg-secondary/10 text-secondary'}`}
                              >
                                {isDirect ? redundancyLabel(roleNames) : `Granted by ${roleNames.join(', ')}`}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PermissionPicker
