import { CircleAlert, CircleCheck, X } from 'lucide-react'

const tones = {
  success: {
    bar: 'bg-emerald-500',
    iconWrap: 'bg-emerald-500/20',
    icon: <CircleCheck className="size-5 fill-emerald-500 text-surface-container-high" />,
  },
  secondary: {
    bar: null,
    iconWrap: 'bg-secondary-container/20',
    icon: <CircleCheck className="size-[18px] text-secondary" />,
  },
  error: {
    bar: 'bg-primary-container',
    iconWrap: 'bg-error-container/40',
    icon: <CircleAlert className="size-5 text-error" />,
  },
}

function AccountNotice({ tone = 'success', title, message, onDismiss }) {
  const style = tones[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="relative flex w-full items-start justify-between gap-4 overflow-hidden rounded-xl bg-surface-container-high/90 p-4 shadow-xl shadow-black/40 backdrop-blur-md"
    >
      {style.bar && <span className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} />}
      <div className={`flex min-w-0 items-start gap-3 ${style.bar ? 'pl-1' : ''}`}>
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${style.iconWrap}`}>
          {style.icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-heading text-base font-bold text-on-surface">{title}</span>
          {message && <p className="text-xs leading-5 text-tertiary">{message}</p>}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-tertiary transition-colors hover:bg-surface-container-highest hover:text-on-surface"
        >
          <X className="size-[18px]" />
        </button>
      )}
    </div>
  )
}

export default AccountNotice
