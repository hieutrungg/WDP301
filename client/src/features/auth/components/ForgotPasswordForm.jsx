import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  KeyRound,
  LockKeyhole,
  Mail,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import PasswordStrength from '../../account/components/PasswordStrength'
import { forgotPasswordRequest, resetPasswordRequest, verifyResetOtpRequest } from '../api/authApi'
import {
  forgotPasswordEmailSchema,
  newPasswordSchema,
  resetOtpSchema,
} from '../schema/forgotPasswordSchema'
import { AuthInput, AuthServerError, PasswordInput } from './AuthFormField'

const RESEND_COOLDOWN_SECONDS = 60
const steps = ['email', 'otp', 'password']

const primaryButtonClass =
  'flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-container text-sm font-bold text-white shadow-crimson-strong transition hover:opacity-95 disabled:cursor-wait disabled:opacity-65'

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
}

function StepHeader({ step, title, description }) {
  const index = steps.indexOf(step)

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-secondary uppercase">
          <ShieldCheck className="size-4" /> Account recovery
        </span>
        {index >= 0 && (
          <span className="text-xs font-semibold text-on-surface-variant">
            Step {index + 1} of {steps.length}
          </span>
        )}
      </div>
      {index >= 0 && (
        <div className="mb-5 flex gap-1.5">
          {steps.map((item, itemIndex) => (
            <span
              key={item}
              className={`h-1 flex-1 rounded-full ${itemIndex <= index ? 'bg-primary-container' : 'bg-surface-container-highest'}`}
            />
          ))}
        </div>
      )}
      <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  )
}

// G04: enter the registered email address.
function EmailStep({ defaultEmail, onSent }) {
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: defaultEmail },
  })

  const onSubmit = async ({ email }) => {
    setServerError('')
    try {
      await forgotPasswordRequest(email)
      toast.success('A verification code has been sent to your email.')
      onSent(email)
    } catch (error) {
      const emailError = getApiFieldErrors(error).find((item) => item.field === 'email')
      if (emailError) setError('email', { message: emailError.message })
      else setServerError(getApiErrorMessage(error))
    }
  }

  return (
    <>
      <StepHeader
        step="email"
        title="Forgot your password?"
        description="Enter the email address you registered with and we'll send you a 6-digit verification code."
      />
      <AuthServerError message={serverError} />
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthInput
          id="forgot-email"
          label="Email address"
          icon={Mail}
          error={errors.email}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
        />
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? <><Spinner /> Sending code...</> : <>Send verification code <ArrowRight className="size-5" /></>}
        </button>
      </form>
    </>
  )
}

// G04b: enter the code sent by email.
function OtpStep({ email, onVerified, onChangeEmail }) {
  const [serverError, setServerError] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [isResending, setIsResending] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetOtpSchema), defaultValues: { otp: '' } })

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const onSubmit = async ({ otp }) => {
    setServerError('')
    try {
      await verifyResetOtpRequest({ email, otp })
      onVerified(otp)
    } catch (error) {
      setServerError(getApiErrorMessage(error))
    }
  }

  const handleResend = async () => {
    setServerError('')
    setIsResending(true)
    try {
      await forgotPasswordRequest(email)
      setCooldown(RESEND_COOLDOWN_SECONDS)
      toast.success('A new verification code has been sent.')
    } catch (error) {
      setServerError(getApiErrorMessage(error))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <>
      <StepHeader
        step="otp"
        title="Enter verification code"
        description="We sent a 6-digit code to your email. It expires 5 minutes after it is sent."
      />
      <div className="mb-5 flex items-center justify-between gap-3 rounded-lg bg-surface-container px-4 py-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-on-surface">
          <Mail className="size-4 shrink-0 text-on-surface-variant" />
          <span className="truncate">{email}</span>
        </span>
        <button type="button" onClick={onChangeEmail} className="shrink-0 text-xs font-semibold text-primary hover:text-white">
          Change
        </button>
      </div>
      <AuthServerError message={serverError} />
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthInput
          id="reset-otp"
          label="Verification code"
          icon={BadgeCheck}
          error={errors.otp}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="[&_input]:text-center [&_input]:text-lg [&_input]:font-bold [&_input]:tracking-[0.35em]"
          {...register('otp')}
        />
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? <><Spinner /> Verifying...</> : 'Verify code'}
        </button>
      </form>
      <button
        type="button"
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface-container text-sm text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-55"
      >
        <RotateCw className={`size-4 ${isResending ? 'animate-spin' : ''}`} />
        {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? 'Sending...' : 'Resend code'}
      </button>
    </>
  )
}

// G04c: choose the new password.
function NewPasswordStep({ email, otp, onReset, onRestart }) {
  const [serverError, setServerError] = useState('')
  const [visible, setVisible] = useState({})
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })
  const newPassword = useWatch({ control, name: 'newPassword' })

  const onSubmit = async (values) => {
    setServerError('')
    try {
      await resetPasswordRequest({ email, otp, ...values })
      onReset()
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in values)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  return (
    <>
      <StepHeader
        step="password"
        title="Set a new password"
        description="Choose a strong password you don't use on other sites."
      />
      {serverError && (
        <div className="mb-5">
          <AuthServerError message={serverError} />
          <button type="button" onClick={onRestart} className="-mt-3 text-xs font-semibold text-primary hover:text-white">
            Request a new code
          </button>
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <PasswordInput
            id="reset-new-password"
            label="New password"
            icon={LockKeyhole}
            error={errors.newPassword}
            visible={visible.next}
            onToggle={() => setVisible((current) => ({ ...current, next: !current.next }))}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('newPassword')}
          />
          <PasswordStrength value={newPassword} compact />
        </div>
        <PasswordInput
          id="reset-confirm-password"
          label="Confirm new password"
          icon={LockKeyhole}
          error={errors.confirmPassword}
          visible={visible.confirm}
          onToggle={() => setVisible((current) => ({ ...current, confirm: !current.confirm }))}
          autoComplete="new-password"
          placeholder="Enter it again"
          {...register('confirmPassword')}
        />
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? <><Spinner /> Resetting...</> : <><KeyRound className="size-5" /> Reset password</>}
        </button>
      </form>
    </>
  )
}

// G04d: success.
function SuccessStep() {
  return (
    <div className="text-center">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-500/15">
        <CircleCheck className="size-9 text-emerald-400" />
      </span>
      <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">Password reset successful</h1>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        Your password has been updated. You can now sign in with your new password.
      </p>
      <Link to="/login" replace className={`${primaryButtonClass} mt-6`}>
        Back to sign in <ArrowRight className="size-5" />
      </Link>
    </div>
  )
}

function ForgotPasswordForm() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const restart = () => {
    setOtp('')
    setStep('email')
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-2xl sm:p-8">
      {step === 'email' && (
        <EmailStep
          defaultEmail={email}
          onSent={(value) => {
            setEmail(value)
            setStep('otp')
          }}
        />
      )}
      {step === 'otp' && (
        <OtpStep
          email={email}
          onChangeEmail={restart}
          onVerified={(value) => {
            setOtp(value)
            setStep('password')
          }}
        />
      )}
      {step === 'password' && (
        <NewPasswordStep email={email} otp={otp} onRestart={restart} onReset={() => setStep('done')} />
      )}
      {step === 'done' && <SuccessStep />}

      {step !== 'done' && (
        <Link to="/login" className="mt-5 flex items-center justify-center gap-1 text-sm text-on-surface-variant hover:text-white">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      )}
    </div>
  )
}

export default ForgotPasswordForm
