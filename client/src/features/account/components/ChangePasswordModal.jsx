import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { AuthServerError, PasswordInput } from '../../auth/components/AuthFormField'
import GoogleCredentialButton from '../../auth/components/GoogleCredentialButton'
import { changePasswordRequest } from '../api/accountApi'
import { changePasswordSchema } from '../schema/accountSchemas'
import ProfileModal from './ProfileModal'

const fieldNames = ['currentPassword', 'newPassword', 'confirmPassword']

function ChangePasswordModal({ onClose }) {
  const [serverError, setServerError] = useState('')
  const [visible, setVisible] = useState({})
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { method: 'password', currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const method = useWatch({ control, name: 'method' })

  const toggle = (name) => setVisible((current) => ({ ...current, [name]: !current[name] }))

  const submit = async (proof) => {
    setServerError('')
    const { newPassword, confirmPassword } = getValues()

    try {
      await changePasswordRequest({ ...proof, newPassword, confirmPassword })
      toast.success('Password updated')
      onClose()
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => fieldNames.includes(item.field))
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  const onSubmitWithPassword = (values) => submit({ currentPassword: values.currentPassword })

  const onGoogleCredential = async (credential) => {
    const valid = await trigger(['newPassword', 'confirmPassword'])
    if (valid) await submit({ credential })
  }

  const tabClass = (value) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      method === value
        ? 'bg-primary-container text-white'
        : 'text-on-surface-variant hover:text-on-surface'
    }`

  return (
    <ProfileModal
      title="Change Password"
      description="Choose how to confirm it's you, then enter a new password."
      onClose={onClose}
    >
      <AuthServerError message={serverError} />

      <div className="mb-5 flex gap-1 rounded-lg bg-surface-container p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === 'password'}
          className={tabClass('password')}
          onClick={() => setValue('method', 'password')}
        >
          Current password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'google'}
          className={tabClass('google')}
          onClick={() => setValue('method', 'google')}
        >
          Google
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmitWithPassword)} noValidate>
        {method === 'password' && (
          <PasswordInput
            id="current-password"
            label="Current password"
            icon={LockKeyhole}
            error={errors.currentPassword}
            visible={visible.current}
            onToggle={() => toggle('current')}
            autoComplete="current-password"
            {...register('currentPassword')}
          />
        )}
        <PasswordInput
          id="new-password"
          label="New password"
          icon={LockKeyhole}
          error={errors.newPassword}
          visible={visible.next}
          onToggle={() => toggle('next')}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register('newPassword')}
        />
        <PasswordInput
          id="confirm-new-password"
          label="Confirm new password"
          icon={LockKeyhole}
          error={errors.confirmPassword}
          visible={visible.confirm}
          onToggle={() => toggle('confirm')}
          autoComplete="new-password"
          {...register('confirmPassword')}
        />

        <div className="rounded-lg bg-surface-container-lowest/70 p-3 text-xs leading-5 text-on-surface-variant">
          Use 8+ characters with uppercase, lowercase, a number, and a special character.
        </div>

        {method === 'password' ? (
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Update password'}
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs leading-5 text-on-surface-variant">
              Signed up with Google and never set a password? Fill in the new password above, then
              confirm with the same Google account to save it.
            </p>
            <GoogleCredentialButton
              onCredential={onGoogleCredential}
              disabled={isSubmitting}
              text="continue_with"
            />
          </div>
        )}
      </form>
    </ProfileModal>
  )
}

export default ChangePasswordModal
