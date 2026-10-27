import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, Briefcase, History, Mail, MailCheck, Phone, Power, PowerOff, RefreshCw, User, UserPlus, UserRoundPen } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { createStaffAccountRequest, updateStaffAccountRequest } from '../api/accessControlApi'
import { useStaffDetail, useStaffFormOptions } from '../hooks/useAccessControl'
import {
  createStaffSchema,
  emptyStaffForm,
  staffProfileSchema,
  toStaffProfileForm,
} from '../schema/accessControlSchemas'
import { changedFields, formatAdminDateTime, inheritedPermissionMap, personLabel } from '../utils/accessControl'
import AdminOverlay from './AdminOverlay'
import FormField, { inputClass } from './FormField'
import { primaryButton, RoleChip, secondaryButton, StatusBadge } from './ListParts'
import PermissionPicker from './PermissionPicker'
import RolePicker from './RolePicker'

const PROFILE_FIELDS = ['fullName', 'email', 'phone', 'branchId', 'position']

function StaffForm({ account, options, onClose, onSaved, onChangeStatus, isSelf, blocked }) {
  const isEdit = Boolean(account)
  const initialValues = isEdit ? toStaffProfileForm(account) : emptyStaffForm
  const [serverError, setServerError] = useState('')
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(isEdit ? staffProfileSchema : createStaffSchema),
    defaultValues: initialValues,
  })
  const selectedRoleIds = useWatch({ control, name: 'roleIds' }) ?? []

  const onSubmit = async (values) => {
    setServerError('')

    try {
      if (isEdit) {
        const changes = changedFields(values, initialValues, PROFILE_FIELDS)
        if (Object.keys(changes).length === 0) {
          toast.info('No changes to save.')
          onClose()
          return
        }
        if ('branchId' in changes) changes.branchId = changes.branchId || null
        const result = await updateStaffAccountRequest(account.id, changes)
        toast.success(result.message, { description: `${result.account.fullName ?? result.account.username} was updated.` })
        onSaved(result.account)
        return
      }

      const payload = { ...values, branchId: values.branchId || null, position: values.position || null }
      const result = await createStaffAccountRequest(payload)
      toast.success(result.message, { description: `@${result.account.username} can now set a password with Forgot password.` })
      if (result.credentialSetup && !result.credentialSetup.emailSent) {
        toast.warning('The welcome email could not be sent.', {
          description: `Ask the staff member to open Forgot password and enter ${result.account.email} to set a password.`,
        })
      }
      onSaved(result.account)
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in emptyStaffForm)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  const inherited = inheritedPermissionMap(options.roles, selectedRoleIds)

  return (
    <AdminOverlay
      variant="drawer"
      icon={isEdit ? UserRoundPen : UserPlus}
      title={isEdit ? 'Update staff account' : 'Create staff account'}
      description={
        isEdit
          ? 'Edit personal and contact details or change the account status. Roles are managed separately.'
          : 'Enter the staff information and assign at least one role.'
      }
      onClose={onClose}
      // `blocked` while the status confirmation is open above this drawer.
      busy={isSubmitting || blocked}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isEdit && (
            <div className="space-y-3 rounded-xl border border-white/5 bg-surface-container p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={account.status} />
                  <span className="text-sm text-on-surface-variant">@{account.username}</span>
                </div>
                {account.status === 'ACTIVE' || account.status === 'DISABLED' ? (
                  <button
                    type="button"
                    onClick={() => onChangeStatus(account)}
                    disabled={isSelf && account.status === 'ACTIVE'}
                    title={isSelf && account.status === 'ACTIVE' ? 'You cannot disable your own account.' : undefined}
                    className={`${secondaryButton} px-3 py-2`}
                  >
                    {account.status === 'ACTIVE' ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                    {account.status === 'ACTIVE' ? 'Disable account' : 'Enable account'}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {account.roles.map((role) => (
                  <RoleChip key={role.id} name={role.name} isSystem={role.isSystem} />
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                <History className="size-4 shrink-0" />
                Created {formatAdminDateTime(account.createdAt)} by {personLabel(account.createdBy)} · Updated{' '}
                {formatAdminDateTime(account.updatedAt)} by {personLabel(account.updatedBy)}
              </p>
            </div>
          )}

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
              {serverError}
            </div>
          )}

          <FormField id="staff-full-name" label="Full name" required icon={User} error={errors.fullName}>
            <input
              id="staff-full-name"
              autoFocus
              maxLength={100}
              aria-invalid={Boolean(errors.fullName)}
              placeholder="Nguyen Van A"
              className={`${inputClass} h-12 pl-10`}
              {...register('fullName')}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="staff-email" label="Email" required icon={Mail} error={errors.email}>
              <input
                id="staff-email"
                type="email"
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
                placeholder="staff@f-cinema.vn"
                className={`${inputClass} h-12 pl-10`}
                {...register('email')}
              />
            </FormField>
            {isEdit ? (
              <FormField id="staff-username" label="Username" hint="The sign-in username cannot be changed." icon={AtSign}>
                <input id="staff-username" value={account.username} readOnly className={`${inputClass} h-12 pl-10`} />
              </FormField>
            ) : (
              <FormField id="staff-username" label="Username" required icon={AtSign} error={errors.username}>
                <input
                  id="staff-username"
                  maxLength={30}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.username)}
                  placeholder="staff_username"
                  className={`${inputClass} h-12 pl-10`}
                  {...register('username')}
                />
              </FormField>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="staff-phone" label="Phone number" required icon={Phone} error={errors.phone}>
              <input
                id="staff-phone"
                type="tel"
                maxLength={20}
                aria-invalid={Boolean(errors.phone)}
                placeholder="0901234567"
                className={`${inputClass} h-12 pl-10`}
                {...register('phone')}
              />
            </FormField>
            <FormField id="staff-position" label="Position" icon={Briefcase} error={errors.position}>
              <input
                id="staff-position"
                maxLength={60}
                aria-invalid={Boolean(errors.position)}
                placeholder="Ticket checker"
                className={`${inputClass} h-12 pl-10`}
                {...register('position')}
              />
            </FormField>
          </div>

          <FormField id="staff-branch" label="Branch" hint="The cinema branch this employee works at." error={errors.branchId}>
            <select id="staff-branch" className={`${inputClass} h-12`} {...register('branchId')}>
              <option value="">No branch assigned</option>
              {options.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
              {isEdit && account.branch && !options.branches.some(({ id }) => id === account.branch.id) && (
                <option value={account.branch.id}>{account.branch.branchName ?? 'Unavailable branch'} (inactive)</option>
              )}
            </select>
          </FormField>

          {!isEdit && (
            <>
              <section aria-labelledby="staff-roles-heading" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 id="staff-roles-heading" className="text-sm font-semibold text-on-surface">
                    Roles
                  </h3>
                  <span className="rounded-full bg-primary-container/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    At least one
                  </span>
                </div>
                <Controller
                  name="roleIds"
                  control={control}
                  render={({ field, fieldState }) => (
                    <RolePicker roles={options.roles} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                  )}
                />
              </section>

              <section aria-labelledby="staff-direct-heading" className="space-y-2">
                <h3 id="staff-direct-heading" className="text-sm font-semibold text-on-surface">
                  Additional direct permissions <span className="font-normal text-on-surface-variant">(optional)</span>
                </h3>
                <Controller
                  name="directPermissionIds"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      {fieldState.error && <p className="text-xs text-red-300">{fieldState.error.message}</p>}
                      <PermissionPicker
                        permissions={options.permissions}
                        value={field.value}
                        onChange={field.onChange}
                        inherited={inherited}
                        idPrefix="staff-direct"
                      />
                    </>
                  )}
                />
              </section>

              <p className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
                <span>
                  <span className="block font-semibold text-on-surface">No password is set here</span>
                  The staff member receives a welcome email and chooses their own password with Forgot
                  password, using the email address above.
                </span>
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || (isEdit && !isDirty)} className={primaryButton}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create staff account'}
          </button>
        </div>
      </form>
    </AdminOverlay>
  )
}

function StaffFormDrawer({ accountId, onClose, onSaved, onChangeStatus, isSelf = false, blocked = false }) {
  const options = useStaffFormOptions()
  const detail = useStaffDetail(accountId)
  const loading = options.isPending || (accountId && detail.isPending)
  const error = options.error || (accountId && detail.error)

  if (loading || error) {
    return (
      <AdminOverlay variant="drawer" icon={accountId ? UserRoundPen : UserPlus} title={accountId ? 'Update staff account' : 'Create staff account'} onClose={onClose}>
        <div className="grid flex-1 place-items-center p-8 text-center text-sm text-on-surface-variant">
          {error ? (
            <div className="space-y-3">
              <p>{getApiErrorMessage(error)}</p>
              <button
                type="button"
                onClick={() => {
                  options.refetch()
                  if (accountId) detail.refetch()
                }}
                className={secondaryButton}
              >
                <RefreshCw className="size-4" />
                Try again
              </button>
            </div>
          ) : (
            'Loading...'
          )}
        </div>
      </AdminOverlay>
    )
  }

  return (
    <StaffForm
      key={detail.data?.updatedAt ?? 'new'}
      account={accountId ? detail.data : null}
      options={options.data}
      onClose={onClose}
      onSaved={onSaved}
      onChangeStatus={onChangeStatus}
      isSelf={isSelf}
      blocked={blocked}
    />
  )
}

export default StaffFormDrawer
