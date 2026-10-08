import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { registerRequest } from '../api/authApi'
import { registerSchema } from '../schema/registerSchema'
import { AuthInput, AuthServerError, FieldError, PasswordInput } from './AuthFormField'
import GoogleSignInButton from './GoogleSignInButton'

function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
    },
  })

  const onSubmit = async (values) => {
    setServerError('')
    setIsPending(true)

    try {
      const response = await registerRequest(values)
      const email = response.data.email
      toast.success('Account created. Enter the code sent to your email.')
      navigate('/verify-email', { state: { email } })
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error)
      fieldErrors.forEach(({ field, message }) => setError(field, { type: 'server', message }))
      setServerError(fieldErrors.length ? '' : getApiErrorMessage(error))
      if (!fieldErrors.length) toast.error(getApiErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
          <ShieldCheck className="size-4" /> New F-Club member
        </div>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">Create F-Cinema Account</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Fast ticket booking and exclusive member privileges await.
        </p>
      </div>

      <AuthServerError message={serverError} />

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthInput id="register-full-name" label="Full name" icon={UserRound} error={errors.fullName} autoComplete="name" placeholder="Nguyen Van A" {...register('fullName')} />
          <AuthInput id="register-email" label="Email address" icon={Mail} error={errors.email} autoComplete="email" type="email" placeholder="you@example.com" {...register('email')} />
          <AuthInput id="register-phone" label="Phone number" icon={Phone} error={errors.phone} autoComplete="tel" type="tel" placeholder="0912 345 678" {...register('phone')} />
          <AuthInput id="register-username" label="Username" icon={UserRound} error={errors.username} autoComplete="username" placeholder="cinema_fan" {...register('username')} />
          <PasswordInput id="register-password" label="Password" icon={LockKeyhole} error={errors.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="At least 8 characters" {...register('password')} />
          <PasswordInput id="register-confirm-password" label="Confirm password" icon={LockKeyhole} error={errors.confirmPassword} visible={showConfirmation} onToggle={() => setShowConfirmation((value) => !value)} autoComplete="new-password" placeholder="Enter it again" {...register('confirmPassword')} />
        </div>

        <div className="rounded-lg bg-surface-container-lowest/70 p-3 text-xs leading-5 text-on-surface-variant">
          Use 8+ characters with uppercase, lowercase, a number, and a special character.
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-on-surface-variant">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary-container" {...register('termsAccepted')} />
            <span>I agree to the Terms of Service and Privacy Policy of F-Cinema Vietnam.</span>
          </label>
          <FieldError message={errors.termsAccepted?.message} />
        </div>

        <button type="submit" disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-container text-sm font-bold uppercase tracking-wide text-white shadow-crimson-strong transition hover:opacity-95 disabled:cursor-wait disabled:opacity-65">
          {isPending ? <><span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> Creating account...</> : <>Create account <ArrowRight className="size-5" /></>}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-xs text-on-surface-variant">
        <span className="h-px flex-1 bg-surface-container-highest" />
        or continue with
        <span className="h-px flex-1 bg-surface-container-highest" />
      </div>

      <GoogleSignInButton onError={setServerError} />

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Already have an account? <Link to="/login" className="font-semibold text-secondary hover:underline">Sign in now</Link>
      </p>
    </div>
  )
}

export default RegisterForm
