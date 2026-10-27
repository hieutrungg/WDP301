import { Info, KeyRound, RefreshCw, ShieldCheck, UserCog } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { assignStaffAccessRequest } from '../api/accessControlApi'
import { useStaffDetail, useStaffFormOptions } from '../hooks/useAccessControl'
import { ROLE_REQUIRED_MESSAGE } from '../schema/accessControlSchemas'
import { effectivePermissionIds, inheritedPermissionMap, sameIdSet } from '../utils/accessControl'
import AdminOverlay from './AdminOverlay'
import ConfirmDialog from './ConfirmDialog'
import { primaryButton, secondaryButton } from './ListParts'
import PermissionPicker from './PermissionPicker'
import RolePicker from './RolePicker'

function namesFor(ids, items) {
  const byId = new Map(items.map((item) => [item.id, item.name]))
  return ids.map((id) => byId.get(id) ?? id)
}

// UC37 Assign Staff Roles & Permissions.
function StaffAccessForm({ account, options, isSelf, onClose, onSaved }) {
  const [roleIds, setRoleIds] = useState(account.roleIds)
  const [directIds, setDirectIds] = useState(account.directPermissionIds)
  const [roleError, setRoleError] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const adminRole = options.roles.find(({ name }) => name === 'ADMIN')
  // An Admin cannot remove the ADMIN role from their own account (lock-out protection).
  const lockedIds = isSelf && adminRole && account.roleIds.includes(adminRole.id) ? [adminRole.id] : []
  const inherited = inheritedPermissionMap(options.roles, roleIds)
  const effective = effectivePermissionIds(options.roles, roleIds, directIds)
  const changed = !sameIdSet(roleIds, account.roleIds) || !sameIdSet(directIds, account.directPermissionIds)
  const redundantCount = directIds.filter((id) => inherited.has(id)).length

  const summary = () => {
    const points = []
    const rolesAdded = roleIds.filter((id) => !account.roleIds.includes(id))
    const rolesRemoved = account.roleIds.filter((id) => !roleIds.includes(id))
    const grantsAdded = directIds.filter((id) => !account.directPermissionIds.includes(id))
    const grantsRemoved = account.directPermissionIds.filter((id) => !directIds.includes(id))
    if (rolesAdded.length) points.push(`Assign roles: ${namesFor(rolesAdded, options.roles).join(', ')}`)
    if (rolesRemoved.length) points.push(`Remove roles: ${namesFor(rolesRemoved, options.roles).join(', ')}`)
    if (grantsAdded.length) points.push(`Grant directly: ${namesFor(grantsAdded, options.permissions).join(', ')}`)
    if (grantsRemoved.length) points.push(`Revoke direct grants: ${namesFor(grantsRemoved, options.permissions).join(', ')}`)
    points.push(`The account will have ${effective.length} effective permissions, applied on its next request.`)
    return points
  }

  const handleSave = () => {
    if (roleIds.length === 0) {
      setRoleError(ROLE_REQUIRED_MESSAGE)
      return
    }
    setConfirming(true)
  }

  const submit = async () => {
    setSubmitting(true)
    setServerError('')

    try {
      const result = await assignStaffAccessRequest(account.id, { roleIds, directPermissionIds: directIds })
      toast.success(result.message, { description: `Access for @${result.account.username} was updated.` })
      onSaved(result.account)
    } catch (error) {
      setConfirming(false)
      const fieldError = getApiFieldErrors(error).find(({ field }) => field === 'roleIds')
      if (fieldError) setRoleError(fieldError.message)
      else setServerError(getApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminOverlay
      variant="drawer"
      icon={UserCog}
      title="Assign roles & permissions"
      description={`${account.fullName ?? account.username} (@${account.username})`}
      onClose={onClose}
      busy={submitting || confirming}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Roles', roleIds.length],
              ['Direct grants', directIds.length],
              ['Effective permissions', effective.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/5 bg-surface-container p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                <p className="mt-1 font-heading text-2xl font-bold text-on-surface">{value}</p>
              </div>
            ))}
          </div>

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
              {serverError}
            </div>
          )}

          <section aria-labelledby="access-roles-heading" className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-secondary" />
              <h3 id="access-roles-heading" className="text-sm font-semibold text-on-surface">
                Assigned roles
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant">The account must keep at least one role.</p>
            <RolePicker
              roles={options.roles}
              value={roleIds}
              lockedIds={lockedIds}
              error={roleError}
              onChange={(ids) => {
                setRoleIds(ids)
                setRoleError(ids.length === 0 ? ROLE_REQUIRED_MESSAGE : '')
              }}
            />
          </section>

          <section aria-labelledby="access-direct-heading" className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-secondary" />
              <h3 id="access-direct-heading" className="text-sm font-semibold text-on-surface">
                Direct permissions
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant">
              Granted to this account in addition to its roles. Untick a permission to revoke the direct grant.
            </p>
            {redundantCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
                <Info className="mt-0.5 size-4 shrink-0" />
                {redundantCount === 1 ? '1 direct grant is' : `${redundantCount} direct grants are`} already provided by an
                assigned role. You can keep {redundantCount === 1 ? 'it' : 'them'} as explicit direct grants.
              </p>
            )}
            <PermissionPicker
              permissions={options.permissions}
              value={directIds}
              onChange={setDirectIds}
              inherited={inherited}
              idPrefix="access-direct"
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={submitting || !changed} className={primaryButton}>
            Save access
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Confirm role and permission changes"
          description={`@${account.username}`}
          points={summary()}
          tone="neutral"
          icon={UserCog}
          confirmLabel="Assign"
          busy={submitting}
          onCancel={() => setConfirming(false)}
          onConfirm={submit}
        />
      )}
    </AdminOverlay>
  )
}

function StaffAccessDrawer({ accountId, isSelf, onClose, onSaved }) {
  const options = useStaffFormOptions()
  const detail = useStaffDetail(accountId)

  if (options.isPending || detail.isPending || options.error || detail.error) {
    const error = options.error || detail.error
    return (
      <AdminOverlay variant="drawer" icon={UserCog} title="Assign roles & permissions" onClose={onClose}>
        <div className="grid flex-1 place-items-center p-8 text-center text-sm text-on-surface-variant">
          {error ? (
            <div className="space-y-3">
              <p>{getApiErrorMessage(error)}</p>
              <button
                type="button"
                onClick={() => {
                  options.refetch()
                  detail.refetch()
                }}
                className={secondaryButton}
              >
                <RefreshCw className="size-4" />
                Try again
              </button>
            </div>
          ) : (
            'Loading access...'
          )}
        </div>
      </AdminOverlay>
    )
  }

  return (
    <StaffAccessForm
      key={detail.data.updatedAt}
      account={detail.data}
      options={options.data}
      isSelf={isSelf}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

export default StaffAccessDrawer
