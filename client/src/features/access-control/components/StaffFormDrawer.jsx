import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, History, Mail, MailCheck, Phone, Power, PowerOff, RefreshCw, ShieldCheck, User, UserPlus, UserRoundPen } from 'lucide-react'
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
import {
  branchRuleForRoles,
  changedFields,
  formatAdminDateTime,
  personLabel,
} from '../utils/accessControl'
import AdminOverlay from './AdminOverlay'
import FormField, { inputClass } from './FormField'
import { primaryButton, RoleChip, secondaryButton, StatusBadge } from './ListParts'
import RolePicker from './RolePicker'

const PROFILE_FIELDS = ['fullName', 'email', 'phone', 'branchId']

function StaffForm({ account, options, onClose, onSaved, onChangeStatus, isSelf, blocked }) {
  const isEdit = Boolean(account)
  const initialValues = isEdit ? toStaffProfileForm(account) : emptyStaffForm
  const [serverError, setServerError] = useState('')
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(isEdit ? staffProfileSchema : createStaffSchema),
    defaultValues: initialValues,
  })
  const selectedRoleIds = useWatch({ control, name: 'roleIds' }) ?? []
  // Staff and Managers need the cinema they work at; a system Admin has none.
  const branchRule = branchRuleForRoles(
    isEdit
      ? (account.roles ?? []).filter((role) => role.assignable !== false)
      : options.roles.filter((role) => selectedRoleIds.includes(role.id)),
  )

  const onSubmit = async (values) => {
    setServerError('')
    if (branchRule === 'REQUIRED' && !values.branchId) {
      setError('branchId', { message: 'Select the cinema branch this employee works at.' })
      return
    }
    if (branchRule === 'NONE') values = { ...values, branchId: '' }

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

      const payload = { ...values, branchId: values.branchId || null }
      const result = await createStaffAccountRequest(payload)
      toast.success(result.message, {
        description: `The sign-in details for @${result.account.username} were emailed to ${result.account.email}.`,
      })
      if (result.credentialSetup && !result.credentialSetup.emailSent) {
        toast.warning('The welcome email could not be sent.', {
          description: `Ask the staff member to use Forgot password with ${result.account.email} to set a new password.`,
        })
      }
      onSaved(result.account)
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in emptyStaffForm)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  const branchField =
    branchRule === 'NONE' ? (
      <p className="rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
        <span className="block font-semibold text-on-surface">No cinema branch</span>
        A system administrator manages every branch, so no branch is assigned.
      </p>
    ) : (
      <FormField
        id="staff-branch"
        label="Branch"
        required={branchRule === 'REQUIRED'}
        hint={
          branchRule === 'REQUIRED'
            ? 'The cinema this employee works at. Their data and actions are limited to this branch.'
            : 'Choose a role first: Staff and Managers need a branch, an Admin has none.'
        }
        error={errors.branchId}
      >
        <select id="staff-branch" className={`${inputClass} h-12`} {...register('branchId')}>
          <option value="" disabled={branchRule === 'REQUIRED'}>
            {branchRule === 'REQUIRED' ? 'Select a branch' : 'No branch assigned'}
          </option>
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
    )

  return (
    <AdminOverlay
      variant="drawer"
      icon={isEdit ? UserRoundPen : UserPlus}
      title={isEdit ? 'Update staff account' : 'Create staff account'}
      description={
        isEdit
          ? 'Edit personal and contact details or change the account status. Roles are managed separately.'
          : 'Enter the staff information, choose a role and, for Staff or Managers, their cinema branch.'
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

          <div className="grid gap-5">
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
          </div>

          {isEdit && branchField}

          {!isEdit && (
            <>
              <section aria-labelledby="staff-roles-heading" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 id="staff-roles-heading" className="text-sm font-semibold text-on-surface">
                    Role
                  </h3>
                  <span className="rounded-full bg-primary-container/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Choose one
                  </span>
                </div>
                <Controller
                  name="roleIds"
                  control={control}
                  render={({ field, fieldState }) => (
                    <RolePicker
                      roles={options.roles}
                      value={field.value}
                      onChange={(ids) => {
                        field.onChange(ids)
                        // An Admin has no branch: clear a branch picked for another role.
                        const roles = options.roles.filter((role) => ids.includes(role.id))
                        if (branchRuleForRoles(roles) === 'NONE') setValue('branchId', '')
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </section>

              {branchField}

              {/* The account gets every permission of its role; exceptions are made later in
                  Assign access, so no permission list is shown here. */}
              <p className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
                <span>
                  <span className="block font-semibold text-on-surface">Permissions come from the role</span>
                  The account gets every permission of the selected role. An Admin can adjust access later
                  with Assign access.
                </span>
              </p>

              <p className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
                <span>
                  <span className="block font-semibold text-on-surface">The password is generated automatically</span>
                  The staff member receives their username and a generated password by email at the address
                  above, and can change the password after signing in.
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
