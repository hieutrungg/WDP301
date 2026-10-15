import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  CircleAlert,
  CircleX,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import GoogleCredentialButton from '../../auth/components/GoogleCredentialButton'
import { changePasswordRequest } from '../api/accountApi'
import AccountBreadcrumb from '../components/AccountBreadcrumb'
import { FieldLabel, FieldMessage } from '../components/AccountField'
import AccountNotice from '../components/AccountNotice'
import PasswordStrength from '../components/PasswordStrength'
import { changePasswordSchema } from '../schema/accountSchemas'

const fieldNames = ['currentPassword', 'newPassword', 'confirmPassword']
const emptyValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

function PasswordField({ id, label, labelAction, error, errorIcon, visible, onToggle, registration, autoComplete }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <FieldLabel htmlFor={id} required>
          {label}
        </FieldLabel>
        {labelAction}
      </div>
      <div className="relative flex items-center">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-error`}
          className={`h-12 w-full rounded-lg bg-surface-container-highest/90 px-4 pr-20 text-sm tracking-wider text-on-surface shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] outline-none placeholder:text-tertiary-container focus:ring-2 ${error ? 'ring-1 ring-error/60 focus:ring-error' : 'focus:ring-primary-container/40'}`}
          {...registration}
        />
        <div className="absolute right-3 flex items-center gap-1">
          {error && <CircleAlert className="pointer-events-none size-5 text-error" />}
          <button
            type="button"
            onClick={onToggle}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="grid size-8 place-items-center rounded-lg text-tertiary transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            {visible ? <EyeOff className="size-[19px]" /> : <Eye className="size-[19px]" />}
          </button>
        </div>
      </div>
      <FieldMessage id={`${id}-error`} icon={errorIcon}>
        {error?.message}
      </FieldMessage>
    </div>
  )
}

function ChangePasswordPage() {
  const [notice, setNotice] = useState(null)
  const [visible, setVisible] = useState({})
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    trigger,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { method: 'password', ...emptyValues },
  })
  const method = useWatch({ control, name: 'method' })
  const newPassword = useWatch({ control, name: 'newPassword' })

  const toggle = (name) => setVisible((current) => ({ ...current, [name]: !current[name] }))

  const switchMethod = (value) => {
    setValue('method', value)
    clearErrors('currentPassword')
  }

  const showNotice = (value) => {
    setNotice(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (proof) => {
    setNotice(null)
    const { newPassword: next, confirmPassword } = getValues()

    try {
      await changePasswordRequest({ ...proof, newPassword: next, confirmPassword })
      reset({ method: 'password', ...emptyValues })
      showNotice({
        tone: 'success',
        title: 'Password changed successfully.',
        message:
          'Your account credentials have been updated. Use your new password the next time you sign in with your email or username.',
      })
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => fieldNames.includes(item.field))
      fieldErrors.forEach(({ field, message }) =>
        setError(field, {
          message:
            field === 'currentPassword' && message === 'Current password is incorrect'
              ? 'Current password is incorrect. Please re-enter your existing password.'
              : message,
        }),
      )
      if (fieldErrors.length === 0) {
        showNotice({ tone: 'error', title: 'Unable to change your password', message: getApiErrorMessage(error) })
      }
    }
  }

  const onSubmitWithPassword = (values) => submit({ currentPassword: values.currentPassword })

  // Google returns the credential asynchronously, so the new-password fields are validated first.
  const onGoogleCredential = async (credential) => {
    const valid = await trigger(['newPassword', 'confirmPassword'])
    if (valid) await submit({ credential })
  }

  return (
    <div className="pt-20">
      <div className="relative w-full overflow-hidden px-4 py-8 md:px-8 md:py-12">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-primary-container/10 opacity-60 blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-48 size-[450px] rounded-full bg-secondary-container/5 opacity-40 blur-[120px]" />

        <div className="relative mx-auto flex max-w-[760px] flex-col gap-6">
          <AccountBreadcrumb
            items={[
              { label: 'Customer Account' },
              { label: 'My Profile', to: '/profile' },
              { label: 'Change Password' },
            ]}
          />

          {notice && <AccountNotice {...notice} onDismiss={() => setNotice(null)} />}

          <section className="flex w-full flex-col gap-8 rounded-xl bg-surface-container-low/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 md:p-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-2.5 rounded-full bg-primary-container" />
                <h1 className="font-heading text-[28px] leading-9 font-bold tracking-tight text-on-surface">
                  Change Password
                </h1>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-tertiary">
                Update your account password to maintain security. Choose a strong, unique password
                that you do not use on other platforms.
              </p>
            </div>

            <form className="flex flex-col gap-7" onSubmit={handleSubmit(onSubmitWithPassword)} noValidate>
              {method === 'password' ? (
                <PasswordField
                  id="current-password"
                  label="Current Password"
                  labelAction={
                    <button
                      type="button"
                      onClick={() => switchMethod('google')}
                      className="text-xs text-primary transition-colors hover:text-on-primary-container hover:underline"
                    >
                      Signed up with Google?
                    </button>
                  }
                  error={errors.currentPassword}
                  errorIcon={TriangleAlert}
                  visible={visible.current}
                  onToggle={() => toggle('current')}
                  autoComplete="current-password"
                  registration={register('currentPassword')}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-heading text-sm font-semibold text-on-surface">
                      Confirm with Google
                    </span>
                    <button
                      type="button"
                      onClick={() => switchMethod('password')}
                      className="text-xs text-primary transition-colors hover:text-on-primary-container hover:underline"
                    >
                      Use current password instead
                    </button>
                  </div>
                  <p className="rounded-lg bg-surface-container p-4 text-xs leading-relaxed text-tertiary">
                    Created your account with Google and never set a password? Enter a new password
                    below, then confirm with the same Google account you use to sign in.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <PasswordField
                  id="new-password"
                  label="New Password"
                  error={errors.newPassword}
                  errorIcon={CircleX}
                  visible={visible.next}
                  onToggle={() => toggle('next')}
                  autoComplete="new-password"
                  registration={register('newPassword')}
                />
                <PasswordStrength value={newPassword} />
              </div>

              <PasswordField
                id="confirm-password"
                label="Confirm New Password"
                error={errors.confirmPassword}
                errorIcon={RefreshCw}
                visible={visible.confirm}
                onToggle={() => toggle('confirm')}
                autoComplete="new-password"
                registration={register('confirmPassword')}
              />

              <div className="flex items-start gap-3 rounded-lg bg-surface-container p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary" />
                <p className="text-xs leading-relaxed text-tertiary">
                  For security, choose a pass-phrase that is unique to F-Cinema. We suggest avoiding
                  birthdays, names of family members, or standard dictionary words.
                </p>
              </div>

              <div className="flex flex-col-reverse items-center justify-end gap-3 pt-4 sm:flex-row">
                <Link
                  to="/profile"
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-surface-container-high px-6 font-heading text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-highest sm:w-auto"
                >
                  Cancel
                </Link>
                {method === 'password' ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 font-heading text-sm font-bold text-on-primary-container shadow-[0_0_20px_rgba(229,9,20,0.45)] transition-all hover:bg-[#ff1b27] hover:shadow-[0_0_28px_rgba(229,9,20,0.65)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                  >
                    <KeyRound className="size-[18px]" />
                    {isSubmitting ? 'Saving...' : 'Change Password'}
                  </button>
                ) : (
                  <div className="w-full sm:w-72">
                    <GoogleCredentialButton
                      onCredential={onGoogleCredential}
                      disabled={isSubmitting}
                      label="Confirm with Google"
                    />
                  </div>
                )}
              </div>
            </form>
          </section>

          <div className="flex justify-center py-2">
            <Link
              to="/profile"
              className="flex items-center gap-1.5 text-xs text-tertiary transition-colors hover:text-on-surface"
            >
              <ArrowLeft className="size-4" />
              Return to My Profile Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordPage
