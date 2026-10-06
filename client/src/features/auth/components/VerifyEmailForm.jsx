import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, BadgeCheck, Mail, RotateCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { resendVerificationRequest, verifyEmailRequest } from '../api/authApi'
import { verifyEmailSchema } from '../schema/registerSchema'
import { AuthInput, AuthServerError } from './AuthFormField'

function VerifyEmailForm() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialEmail = location.state?.email || ''
  const [serverError, setServerError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(initialEmail ? 60 : 0)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: initialEmail, otp: '' },
  })

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const onSubmit = async (values) => {
    setServerError('')
    setIsVerifying(true)
    try {
      await verifyEmailRequest(values)
      toast.success('Email verified. You can now sign in.')
      navigate('/login', { replace: true })
    } catch (error) {
      const message = getApiErrorMessage(error)
      setServerError(message)
      toast.error(message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    const email = getValues('email').trim()
    if (!email) {
      setServerError('Enter the email address you registered with.')
      return
    }

    setServerError('')
    setIsResending(true)
    try {
      await resendVerificationRequest(email)
      setCooldown(60)
      toast.success('If the account is awaiting verification, a new code has been sent.')
    } catch (error) {
      const message = getApiErrorMessage(error)
      setServerError(message)
      toast.error(message)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary"><ShieldCheck className="size-4" /> Secure verification</div>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">Verify your email</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Enter the 6-digit code. It expires 5 minutes after it is sent.</p>
      </div>

      <AuthServerError message={serverError} />

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthInput id="verify-email" label="Email address" icon={Mail} error={errors.email} type="email" autoComplete="email" readOnly={Boolean(initialEmail)} {...register('email')} />
        <AuthInput id="verify-otp" label="Verification code" icon={BadgeCheck} error={errors.otp} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="[&_input]:text-center [&_input]:text-lg [&_input]:font-bold [&_input]:tracking-[0.35em]" {...register('otp')} />

        <button type="submit" disabled={isVerifying} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-container text-sm font-bold text-white shadow-crimson-strong transition hover:opacity-95 disabled:cursor-wait disabled:opacity-65">
          {isVerifying ? <><span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> Verifying...</> : 'Verify email'}
        </button>
      </form>

      <button type="button" onClick={handleResend} disabled={isResending || cooldown > 0} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface-container text-sm text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-55">
        <RotateCw className={`size-4 ${isResending ? 'animate-spin' : ''}`} />
        {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? 'Sending...' : 'Resend code'}
      </button>

      <Link to="/register" className="mt-5 flex items-center justify-center gap-1 text-sm text-on-surface-variant hover:text-white"><ArrowLeft className="size-4" /> Back to registration</Link>
    </div>
  )
}

export default VerifyEmailForm
