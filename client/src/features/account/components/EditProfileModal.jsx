import { zodResolver } from '@hookform/resolvers/zod'
import { Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { AuthInput, AuthServerError } from '../../auth/components/AuthFormField'
import { useAuthStore } from '../../auth/store/authStore'
import { updateProfileRequest } from '../api/accountApi'
import { editProfileSchema } from '../schema/accountSchemas'
import ProfileModal from './ProfileModal'

function EditProfileModal({ account, onClose }) {
  const [serverError, setServerError] = useState('')
  const setAccount = useAuthStore((state) => state.setAccount)
  const initialValues = {
    fullName: account.profile?.fullName ?? '',
    phone: account.phone ?? '',
  }
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(editProfileSchema),
    defaultValues: initialValues,
  })

  const onSubmit = async (values) => {
    setServerError('')

    const changes = {}
    if (values.fullName !== initialValues.fullName) changes.fullName = values.fullName
    if (values.phone && values.phone !== initialValues.phone) changes.phone = values.phone

    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save.')
      onClose()
      return
    }

    try {
      setAccount(await updateProfileRequest(changes))
      toast.success('Profile updated')
      onClose()
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in initialValues)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  return (
    <ProfileModal
      title="Edit Profile"
      description="Update how we reach you. Your email and username can't be changed."
      onClose={onClose}
    >
      <AuthServerError message={serverError} />

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthInput
          id="edit-full-name"
          label="Full name"
          icon={UserRound}
          error={errors.fullName}
          autoComplete="name"
          {...register('fullName')}
        />
        <AuthInput
          id="edit-phone"
          label="Phone number"
          icon={Phone}
          type="tel"
          error={errors.phone}
          autoComplete="tel"
          placeholder="0912 345 678"
          {...register('phone')}
        />

        <div className="grid gap-4 rounded-lg bg-surface-container-lowest/70 p-3 text-xs text-on-surface-variant sm:grid-cols-2">
          <p>
            Email
            <span className="mt-1 block truncate text-sm font-semibold text-on-surface">
              {account.email}
            </span>
          </p>
          <p>
            Username
            <span className="mt-1 block truncate text-sm font-semibold text-on-surface">
              {account.username}
            </span>
          </p>
        </div>

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
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </ProfileModal>
  )
}

export default EditProfileModal
