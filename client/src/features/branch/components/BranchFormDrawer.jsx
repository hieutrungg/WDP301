import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, History, Mail, Phone, ShieldCheck, Store } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { createBranchRequest, updateBranchRequest } from '../api/branchApi'
import { branchFormSchema, emptyBranchForm, toBranchForm } from '../schema/branchSchema'
import { formatDateTime } from '../utils/branchFormat'
import BranchOverlay from './BranchOverlay'

const inputClass =
  'w-full rounded-lg border border-transparent bg-surface-container px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 aria-[invalid=true]:border-red-400/50'

function Field({ id, label, hint, required, icon: Icon, error, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-on-surface">
          {label}
        </label>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${required ? 'bg-primary-container/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-on-surface-variant" />}
        {children}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-300">{error.message}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>
      )}
    </div>
  )
}

function BranchFormDrawer({ branch, onClose, onSaved }) {
  const isEdit = Boolean(branch)
  const [serverError, setServerError] = useState('')
  const initialValues = isEdit ? toBranchForm(branch) : emptyBranchForm
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(branchFormSchema), defaultValues: initialValues })

  const onSubmit = async (values) => {
    setServerError('')

    try {
      let saved
      if (isEdit) {
        // Send only changed fields; an emptied optional field is sent as "" and cleared server-side.
        const changes = Object.fromEntries(
          ['branchName', 'address', 'email', 'hotline']
            .filter((field) => values[field] !== initialValues[field])
            .map((field) => [field, values[field]]),
        )

        if (Object.keys(changes).length === 0) {
          toast.info('No changes to save.')
          onClose()
          return
        }

        saved = await updateBranchRequest(branch.id, changes)
        toast.success('Branch updated', { description: `${saved.branchName} was saved.` })
      } else {
        saved = await createBranchRequest(values)
        toast.success('Branch created', { description: `${saved.branchName} was added.` })
      }

      onSaved(saved)
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in initialValues)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  return (
    <BranchOverlay
      variant="drawer"
      icon={Store}
      title={isEdit ? 'Edit cinema branch' : 'Add new branch'}
      description={
        isEdit
          ? 'Contact changes apply immediately to customer-facing branch information.'
          : 'New branches can receive rooms and showtimes once they are active.'
      }
      onClose={onClose}
      busy={isSubmitting}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isEdit && (
            <p className="flex items-center gap-2 rounded-lg bg-surface-container-lowest/70 px-3 py-2 text-xs text-on-surface-variant">
              <History className="size-4 shrink-0" />
              Last modified {formatDateTime(branch.updatedAt) ?? '—'}
            </p>
          )}

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
              {serverError}
            </div>
          )}

          <Field
            id="branch-name"
            label="Branch name"
            hint="Shown to customers. Must be unique, ignoring letter case and extra spaces."
            required
            icon={Building2}
            error={errors.branchName}
          >
            <input
              id="branch-name"
              autoFocus
              maxLength={120}
              aria-invalid={Boolean(errors.branchName)}
              placeholder="F-Cinema Landmark 81"
              className={`${inputClass} h-12 pl-10`}
              {...register('branchName')}
            />
          </Field>

          <Field id="branch-address" label="Address" required error={errors.address}>
            <textarea
              id="branch-address"
              rows={3}
              maxLength={300}
              aria-invalid={Boolean(errors.address)}
              placeholder="720A Dien Bien Phu, Ward 22, Binh Thanh District, Ho Chi Minh City"
              className={`${inputClass} resize-none py-3`}
              {...register('address')}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="branch-hotline" label="Hotline" hint="Digits only are stored." icon={Phone} error={errors.hotline}>
              <input
                id="branch-hotline"
                type="tel"
                maxLength={24}
                aria-invalid={Boolean(errors.hotline)}
                placeholder="1900 1001"
                className={`${inputClass} h-12 pl-10`}
                {...register('hotline')}
              />
            </Field>
            <Field id="branch-email" label="Email" icon={Mail} error={errors.email}>
              <input
                id="branch-email"
                type="email"
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
                placeholder="branch@f-cinema.vn"
                className={`${inputClass} h-12 pl-10`}
                {...register('email')}
              />
            </Field>
          </div>

          {isEdit ? (
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
              <p>
                <span className="block font-semibold text-on-surface">Status changes are separate</span>
                Use Enable/Disable on the branch list. A branch with upcoming published showtimes
                cannot be set to inactive.
              </p>
            </div>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-on-surface">Initial status</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['ACTIVE', 'Active', 'Visible to customers'],
                  ['INACTIVE', 'Inactive', 'Hidden until enabled'],
                ].map(([value, label, hint]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-surface-container p-3 has-[:checked]:border-primary-container/50 has-[:checked]:bg-primary-container/10"
                  >
                    <input type="radio" value={value} className="mt-1 accent-primary-container" {...register('status')} />
                    <span>
                      <span className="block text-sm font-semibold text-on-surface">{label}</span>
                      <span className="text-xs text-on-surface-variant">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (isEdit && !isDirty)}
            className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create branch'}
          </button>
        </div>
      </form>
    </BranchOverlay>
  )
}

export default BranchFormDrawer
