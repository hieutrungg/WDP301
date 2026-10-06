import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useLogin } from '../hooks/useLogin'
import { loginSchema } from '../schema/loginSchema'

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-red-300">{message}</p>
}

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const { login, isPending } = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identity: '', password: '', rememberMe: false },
  })

  const onSubmit = async (values) => {
    setServerError('')

    try {
      await login(values)
      toast.success('Welcome back to F-Cinema!')
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (error) {
      setServerError(getApiErrorMessage(error))
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
          <ShieldCheck className="size-4" />
          Secure member access
        </div>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">
          Sign In to F-Cinema
        </h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Enter your credentials to access tickets, concessions, and exclusive F-Club privileges.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="login-identity" className="mb-2 block text-sm font-semibold text-on-surface">
            Email or username
          </label>
          <div className="relative">
            <UserRound className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" />
            <input
              id="login-identity"
              autoComplete="username"
              placeholder="username@example.com or username"
              aria-invalid={Boolean(errors.identity)}
              className="h-12 w-full rounded-lg border border-transparent bg-surface-container pl-11 pr-4 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20"
              {...register('identity')}
            />
          </div>
          <FieldError message={errors.identity?.message} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-semibold text-on-surface">
              Password
            </label>
            <button type="button" className="text-xs text-primary transition hover:text-white">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <LockKeyhole className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              className="h-12 w-full rounded-lg border border-transparent bg-surface-container pl-11 pr-11 text-sm text-on-surface outline-none transition focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant transition hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              className="size-4 accent-primary-container"
              {...register('rememberMe')}
            />
            Remember me
          </label>
          <span className="hidden items-center gap-1 text-xs text-on-surface-variant/70 sm:flex">
            <ShieldCheck className="size-3.5 text-secondary" /> F-Club ID
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-container text-sm font-bold text-white shadow-crimson-strong transition hover:opacity-95 disabled:cursor-wait disabled:opacity-65"
        >
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Signing in...
            </>
          ) : (
            <>
              Sign In <ArrowRight className="size-5" />
            </>
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-xs text-on-surface-variant">
        <span className="h-px flex-1 bg-surface-container-highest" />
        or continue with
        <span className="h-px flex-1 bg-surface-container-highest" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled className="h-11 rounded-lg bg-surface-container text-sm text-on-surface opacity-70">
          Google
        </button>
        <button type="button" disabled className="h-11 rounded-lg bg-surface-container text-sm text-on-surface opacity-70">
          Apple ID
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Don&apos;t have an account yet?{' '}
        <Link to="/register" className="font-semibold text-primary transition hover:text-white hover:underline">
          Register now
        </Link>
      </p>
    </div>
  )
}

export default LoginForm
