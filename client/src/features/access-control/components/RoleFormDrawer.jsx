import { zodResolver } from '@hookform/resolvers/zod'
import { History, KeyRound, Lock, RefreshCw, ShieldCheck, ShieldPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { assignRolePermissionsRequest, createRoleRequest, updateRoleRequest } from '../api/accessControlApi'
import { usePermissionCatalog, useRoleDetail } from '../hooks/useAccessControl'
import { roleInfoSchema, toRoleForm } from '../schema/accessControlSchemas'
import {
  affectedAccountsMessage,
  formatAdminDateTime,
  getApiErrorCode,
  NO_PERMISSIONS_MESSAGE,
  personLabel,
  roleSaveConfirmations,
  sameIdSet,
} from '../utils/accessControl'
import AdminOverlay from './AdminOverlay'
import ConfirmDialog from './ConfirmDialog'
import FormField, { inputClass } from './FormField'
import { primaryButton, secondaryButton } from './ListParts'
import PermissionPicker from './PermissionPicker'

const CONFIRMATION_CODES = {
  ROLE_EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED: 'noPermissions',
  ROLE_AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED: 'affectedAccounts',
}

const TITLES = {
  create: ['Create role', 'Name the role and choose what its holders are allowed to do.'],
  edit: ['Update role', 'Change the role details and/or its permissions.'],
  permissions: ['Assign permissions to role', 'Grant or revoke permissions from the predefined list.'],
}

function RoleForm({ mode, role, permissions, onClose, onSaved }) {
  const isCreate = mode === 'create'
  const showInfo = mode !== 'permissions'
  const locked = Boolean(role?.isLocked)
  const initialInfo = toRoleForm(role)
  const initialPermissionIds = role?.permissionIds ?? []
  const [permissionIds, setPermissionIds] = useState(initialPermissionIds)
  const [permissionError, setPermissionError] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(roleInfoSchema), defaultValues: initialInfo })

  const permissionsChanged = !sameIdSet(permissionIds, initialPermissionIds)

  const buildPayload = (values) => {
    if (isCreate) return { name: values.name, description: values.description, permissionIds }
    if (mode === 'permissions') return { permissionIds }

    const payload = {}
    if (values.name.trim() !== initialInfo.name) payload.name = values.name
    if (values.description.trim() !== initialInfo.description) payload.description = values.description
    if (permissionsChanged) payload.permissionIds = permissionIds
    return payload
  }

  const send = async (payload, flags) => {
    setSubmitting(true)
    setServerError('')
    setPermissionError('')

    try {
      const body = { ...payload, confirmNoPermissions: flags.noPermissions, confirmAffectedAccounts: flags.affectedAccounts }
      if (isCreate) delete body.confirmAffectedAccounts
      const result = isCreate
        ? await createRoleRequest(body)
        : mode === 'permissions'
          ? await assignRolePermissionsRequest(role.id, body)
          : await updateRoleRequest(role.id, body)

      toast.success(result.message, { description: `${result.role.name} · ${result.role.permissionCount} permissions` })
      setConfirmation(null)
      onSaved(result.role)
    } catch (error) {
      const confirmationKind = CONFIRMATION_CODES[getApiErrorCode(error)]
      if (confirmationKind) {
        // The server saw something the screen did not (for example, a role newly assigned to staff).
        setConfirmation({
          payload,
          flags: { ...flags, [confirmationKind]: false },
          points: [getApiErrorMessage(error)],
          serverKind: confirmationKind,
        })
        return
      }

      setConfirmation(null)
      const fieldErrors = getApiFieldErrors(error)
      fieldErrors
        .filter(({ field }) => field === 'name' || field === 'description')
        .forEach(({ field, message }) => setError(field, { message }))
      const pickerError = fieldErrors.find(({ field }) => field === 'permissionIds')
      if (pickerError) setPermissionError(pickerError.message)
      if (!fieldErrors.some(({ field }) => ['name', 'description', 'permissionIds'].includes(field))) {
        setServerError(getApiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = (values) => {
    const payload = buildPayload(values)
    if (!isCreate && Object.keys(payload).length === 0) {
      toast.info('No changes to save.')
      onClose()
      return
    }

    const needed = roleSaveConfirmations({
      permissionIds: isCreate || payload.permissionIds ? permissionIds : undefined,
      activeAccountCount: isCreate ? 0 : role.activeAccountCount,
    })

    if (needed.length === 0) {
      send(payload, { noPermissions: false, affectedAccounts: false })
      return
    }

    setConfirmation({
      payload,
      flags: { noPermissions: false, affectedAccounts: false },
      points: needed.map((kind) =>
        kind === 'noPermissions' ? NO_PERMISSIONS_MESSAGE : affectedAccountsMessage(role.activeAccountCount),
      ),
      kinds: needed,
    })
  }

  const confirm = () => {
    const kinds = confirmation.kinds ?? [confirmation.serverKind]
    const flags = { ...confirmation.flags }
    for (const kind of kinds) flags[kind] = true
    send(confirmation.payload, flags)
  }

  const canSave = !locked && (isCreate || isDirty || permissionsChanged)
  const [title, description] = TITLES[mode]

  return (
    <AdminOverlay
      variant="drawer"
      icon={isCreate ? ShieldPlus : KeyRound}
      title={title}
      description={role ? `${role.name} — ${description}` : description}
      onClose={onClose}
      busy={submitting || Boolean(confirmation)}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {role && (
            <div className="grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
              <p className="flex items-center gap-2 rounded-lg bg-surface-container-lowest/70 px-3 py-2">
                <Users className="size-4 shrink-0" />
                Assigned to {role.activeAccountCount} active {role.activeAccountCount === 1 ? 'account' : 'accounts'}
              </p>
              <p className="flex items-center gap-2 rounded-lg bg-surface-container-lowest/70 px-3 py-2">
                <History className="size-4 shrink-0" />
                Updated {formatAdminDateTime(role.updatedAt)} by {personLabel(role.updatedBy)}
              </p>
            </div>
          )}

          {locked && (
            <p className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-sm text-on-surface-variant">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
              The {role.name} role is managed by the system. It always keeps every permission and
              cannot be renamed or changed, so administrators can never be locked out.
            </p>
          )}

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
              {serverError}
            </div>
          )}

          {showInfo && (
            <>
              <FormField
                id="role-name"
                label="Role name"
                required
                hint={role?.isSystem ? 'System role names cannot be changed.' : 'Letters, numbers, spaces, - and _. Must be unique.'}
                error={errors.name}
              >
                <input
                  id="role-name"
                  autoFocus={isCreate}
                  maxLength={50}
                  // readOnly (not disabled) so react-hook-form still submits the value.
                  readOnly={locked || role?.isSystem}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'role-name-error' : undefined}
                  placeholder="Ticket Checker"
                  className={`${inputClass} h-12`}
                  {...register('name')}
                />
              </FormField>

              <FormField id="role-description" label="Description" error={errors.description}>
                <textarea
                  id="role-description"
                  rows={2}
                  maxLength={200}
                  disabled={locked}
                  aria-invalid={Boolean(errors.description)}
                  placeholder="What this role is for"
                  className={`${inputClass} resize-none py-3`}
                  {...register('description')}
                />
              </FormField>
            </>
          )}

          <section aria-labelledby="role-permissions-heading" className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-secondary" />
              <h3 id="role-permissions-heading" className="text-sm font-semibold text-on-surface">
                Permissions
              </h3>
            </div>
            {permissionError && <p className="text-xs text-red-300">{permissionError}</p>}
            <PermissionPicker
              permissions={permissions}
              value={permissionIds}
              onChange={(ids) => {
                setPermissionIds(ids)
                setPermissionError('')
              }}
              disabled={locked}
              idPrefix="role-permission"
              emptyHint="No permission selected: this role will have no access rights."
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className={secondaryButton}>
            {locked ? 'Close' : 'Cancel'}
          </button>
          {!locked && (
            <button type="submit" disabled={submitting || !canSave} className={primaryButton}>
              {submitting ? 'Saving...' : isCreate ? 'Create role' : mode === 'permissions' ? 'Assign permissions' : 'Save changes'}
            </button>
          )}
        </div>
      </form>

      {confirmation && (
        <ConfirmDialog
          title="Confirm role changes"
          description={isCreate ? getValues('name') : role.name}
          points={confirmation.points}
          confirmLabel={isCreate ? 'Create role' : 'Save anyway'}
          busy={submitting}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirm}
        />
      )}
    </AdminOverlay>
  )
}

function RoleFormDrawer({ mode, roleId, onClose, onSaved }) {
  const catalog = usePermissionCatalog()
  const detail = useRoleDetail(mode === 'create' ? null : roleId)
  const loading = catalog.isPending || (mode !== 'create' && detail.isPending)
  const error = catalog.error || (mode !== 'create' && detail.error)

  if (loading || error) {
    const [title] = TITLES[mode]
    return (
      <AdminOverlay variant="drawer" icon={KeyRound} title={title} onClose={onClose}>
        <div className="grid flex-1 place-items-center p-8 text-center text-sm text-on-surface-variant">
          {error ? (
            <div className="space-y-3">
              <p>{getApiErrorMessage(error)}</p>
              <button
                type="button"
                onClick={() => {
                  catalog.refetch()
                  if (mode !== 'create') detail.refetch()
                }}
                className={secondaryButton}
              >
                <RefreshCw className="size-4" />
                Try again
              </button>
            </div>
          ) : (
            'Loading role...'
          )}
        </div>
      </AdminOverlay>
    )
  }

  return (
    <RoleForm
      key={detail.data?.updatedAt ?? 'new'}
      mode={mode}
      role={mode === 'create' ? null : detail.data}
      permissions={catalog.data}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

export default RoleFormDrawer
