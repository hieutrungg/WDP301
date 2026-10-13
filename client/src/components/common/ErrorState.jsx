import { CircleAlert, RotateCcw } from 'lucide-react'

function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-error-container/60 bg-error-container/10 px-6 py-12 text-center">
      <CircleAlert className="mb-4 size-10 text-primary" aria-hidden="true" />
      <h2 className="font-heading text-xl font-bold text-on-surface">We could not load the movies</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90">
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}

export default ErrorState
