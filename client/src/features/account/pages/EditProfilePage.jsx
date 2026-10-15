import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Drama,
  IdCard,
  Info,
  Lock,
  Save,
  TriangleAlert,
  UserCog,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import { useAuthStore } from '../../auth/store/authStore'
import { updateProfileRequest } from '../api/accountApi'
import AccountBreadcrumb from '../components/AccountBreadcrumb'
import { errorRingClass, FieldBadge, FieldLabel, FieldMessage } from '../components/AccountField'
import AccountNotice from '../components/AccountNotice'
import { editProfileSchema } from '../schema/accountSchemas'
import { formatDate, getAvatarLabel, getDisplayName } from '../utils/accountFormat'

const inputClass =
  'h-12 w-full rounded-lg bg-surface-container px-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:bg-surface-container-high'
const readOnlyInputClass =
  'h-12 w-full cursor-not-allowed rounded-lg bg-surface-container-lowest/80 pl-4 pr-10 text-sm text-on-surface-variant opacity-90 select-none'

const toFormValues = (account) => ({
  fullName: account.profile?.fullName ?? '',
  phone: account.phone ?? '',
})

function EditProfilePage() {
  const { account } = useAuth()
  const setAccount = useAuthStore((state) => state.setAccount)
  const [notice, setNotice] = useState(null)
  const isCustomer = account.roles?.some((role) => role.name === 'CUSTOMER')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(editProfileSchema),
    defaultValues: toFormValues(account),
  })

  const showNotice = (value) => {
    setNotice(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSubmit = async (values) => {
    setNotice(null)
    const initial = toFormValues(account)
    const changes = {}
    if (values.fullName !== initial.fullName) changes.fullName = values.fullName
    if (values.phone && values.phone !== initial.phone) changes.phone = values.phone

    if (Object.keys(changes).length === 0) {
      toast.info('There are no changes to save.')
      return
    }

    try {
      const updated = await updateProfileRequest(changes)
      setAccount(updated)
      reset(toFormValues(updated))
      showNotice({
        tone: 'secondary',
        title: 'Profile updated successfully!',
        message: 'Your personal details have been saved to your F-Cinema account.',
      })
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in initial)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) {
        showNotice({ tone: 'error', title: 'Unable to save your profile', message: getApiErrorMessage(error) })
      }
    }
  }

  return (
    <div className="pt-20">
      <div className="relative w-full overflow-hidden px-4 py-6 md:px-8 md:py-10">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[130px]" />
        <div className="pointer-events-none absolute top-48 -right-32 size-80 rounded-full bg-secondary-container/5 blur-[100px]" />

        <div className="relative mx-auto flex max-w-[800px] flex-col gap-6">
          <AccountBreadcrumb
            items={[
              { label: 'Customer Account' },
              { label: 'My Profile', to: '/profile' },
              { label: 'Edit Profile' },
            ]}
          />

          {notice && <AccountNotice {...notice} onDismiss={() => setNotice(null)} />}

          <div className="flex w-full flex-col gap-10 rounded-2xl bg-surface-container-low p-4 shadow-2xl shadow-black/60 md:p-10">
            <div className="flex flex-col gap-1 pb-4">
              <div className="flex items-center gap-2">
                <UserCog className="size-[26px] text-primary-container" />
                <h1 className="font-heading text-[28px] leading-9 font-bold tracking-tight text-on-surface">
                  Edit Profile
                </h1>
              </div>
              <p className="text-sm text-on-surface-variant">
                Update your personal details. Certain account credentials cannot be changed directly.
              </p>
            </div>

            <div className="flex items-center gap-6 rounded-xl bg-surface-container p-6">
              <span className="grid size-24 shrink-0 place-items-center rounded-full bg-surface-container-high font-heading text-4xl font-bold text-primary shadow-lg">
                {getAvatarLabel(account)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-heading text-lg font-semibold text-on-surface">
                    {getDisplayName(account)}
                  </span>
                  <span className="shrink-0 rounded-md bg-secondary/15 px-1.5 py-0.5 text-[11px] leading-[14px] font-bold tracking-wider text-secondary uppercase">
                    {isCustomer ? 'Member' : account.roles?.[0]?.name}
                  </span>
                </div>
                <span className="truncate text-xs text-tertiary">@{account.username}</span>
                {formatDate(account.createdAt) && (
                  <span className="text-xs text-on-surface-variant/80">
                    Member since {formatDate(account.createdAt)}
                  </span>
                )}
              </div>
            </div>

            <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="full-name" required>
                  Full Name
                </FieldLabel>
                <div className="relative">
                  <input
                    id="full-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby="full-name-error"
                    className={`${inputClass} pr-11 ${errors.fullName ? errorRingClass : 'shadow-inner'}`}
                    {...register('fullName')}
                  />
                  <span className={`pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 ${errors.fullName ? 'text-error' : 'text-tertiary'}`}>
                    {errors.fullName ? <CircleAlert className="size-5" /> : <IdCard className="size-5" />}
                  </span>
                </div>
                <FieldMessage id="full-name-error" icon={TriangleAlert}>
                  {errors.fullName?.message}
                </FieldMessage>
                <p className="flex items-center gap-1 text-xs text-tertiary">
                  <Info className="size-[15px] shrink-0 text-secondary" />
                  Shown on your bookings and e-tickets.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="username" muted>
                      Username
                    </FieldLabel>
                    <FieldBadge icon={Lock}>Read-only</FieldBadge>
                  </div>
                  <div className="relative">
                    <input id="username" type="text" value={account.username} disabled readOnly className={readOnlyInputClass} />
                    <Lock className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-outline-variant" />
                  </div>
                  <p className="text-xs text-outline">
                    Unique account handle assigned during registration. Cannot be modified.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="email" muted>
                      Email Address
                    </FieldLabel>
                    {account.status === 'ACTIVE' && (
                      <FieldBadge icon={BadgeCheck} tone="secondary">
                        Verified
                      </FieldBadge>
                    )}
                  </div>
                  <div className="relative">
                    <input id="email" type="email" value={account.email} disabled readOnly className={readOnlyInputClass} />
                    <CircleCheck className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-secondary" />
                  </div>
                  <p className="text-xs text-outline">
                    Linked to electronic ticket delivery. Cannot be modified.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="phone-number">Phone Number</FieldLabel>
                  {errors.phone && (
                    <span className="text-[11px] leading-[14px] font-semibold tracking-wider text-error uppercase">
                      Format issue detected
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 items-center gap-1 text-sm font-medium">
                    <span className="text-tertiary">VN</span>
                    <span className="text-outline-variant">|</span>
                  </span>
                  <input
                    id="phone-number"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0912 345 678"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby="phone-error phone-guideline"
                    className={`${inputClass} pr-11 pl-16 ${errors.phone ? errorRingClass : 'shadow-inner'}`}
                    {...register('phone')}
                  />
                  {errors.phone && (
                    <CircleAlert className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-error" />
                  )}
                </div>
                <FieldMessage id="phone-error" icon={TriangleAlert}>
                  {errors.phone?.message}
                </FieldMessage>
                <p id="phone-guideline" className="text-xs text-tertiary">
                  Vietnamese mobile number starting with 0 or +84, used to contact you about your bookings.
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-surface-container p-4">
                <Drama className="mt-0.5 size-5 shrink-0 text-secondary" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-on-surface">Booking Contact Note</span>
                  <p className="text-xs text-on-surface-variant">
                    Your name and phone number help us reach you about your bookings. Keep them up to date.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse items-center justify-end gap-4 pt-6 sm:flex-row">
                <Link
                  to="/profile"
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-surface-container px-10 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:w-auto"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-container px-10 font-heading text-sm font-bold text-on-primary-container shadow-[0_0_20px_rgba(229,9,20,0.45)] transition-all hover:bg-primary-container/90 hover:shadow-[0_0_28px_rgba(229,9,20,0.65)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  <Save className="size-5" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          <p className="flex items-center justify-center gap-1.5 pb-10 text-center text-xs text-tertiary">
            <CircleHelp className="size-4 shrink-0" />
            Need to change your email address or username? Please contact F-Cinema support.
          </p>
        </div>
      </div>
    </div>
  )
}

export default EditProfilePage
