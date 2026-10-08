import { BadgeCheck, KeyRound, Lock, Pencil } from 'lucide-react'
import {
  formatAccountStatus,
  getAvatarLabel,
  getDisplayName,
} from '../utils/accountFormat'

function ProfileSummaryCard({ account, onEditProfile, onChangePassword }) {
  const isActive = account.status === 'ACTIVE'
  const roleNames = account.roles?.map((role) => role.name).join(', ')

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6 shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-primary-container/15 blur-[60px]" />

      <div className="relative flex flex-col items-center text-center">
        <div className="rounded-full bg-gradient-to-tr from-primary-container via-surface-container-highest to-surface-variant p-1 shadow-2xl">
          <span className="grid size-26 place-items-center rounded-full bg-surface-container-high font-heading text-4xl font-bold text-primary">
            {getAvatarLabel(account)}
          </span>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading text-[22px] leading-[30px] font-bold text-on-surface">
              {getDisplayName(account)}
            </h2>
            {isActive && (
              <BadgeCheck className="size-5 text-primary" aria-label="Verified account" />
            )}
          </div>
          <span className="text-sm text-on-surface-variant">@{account.username}</span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-surface-container-highest px-4 py-1">
          <span className="relative flex size-2">
            {isActive && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex size-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-on-surface-variant'}`}
            />
          </span>
          <span className="text-[11px] leading-[14px] font-bold tracking-wide text-on-surface uppercase">
            {formatAccountStatus(account.status)}
          </span>
        </div>
      </div>

      <dl className="relative mt-6 flex flex-col gap-2 rounded-lg bg-surface-container p-4 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Account Type</dt>
          <dd className="truncate font-semibold text-on-surface">{roleNames || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Username</dt>
          <dd className="truncate font-semibold text-on-surface">{account.username}</dd>
        </div>
      </dl>

      <div className="relative mt-4 flex items-start gap-2 rounded-lg bg-surface-container/60 p-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-on-surface-variant">
          This is your private customer profile. Only you have access to view and update this
          personal information.
        </p>
      </div>

      <div className="relative mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={onEditProfile}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-container font-heading text-lg font-semibold text-on-primary-container shadow-crimson transition-all hover:bg-primary-container/90"
        >
          <Pencil className="size-5" />
          Edit Profile
        </button>
        <button
          type="button"
          onClick={onChangePassword}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
        >
          <KeyRound className="size-[18px] text-on-surface-variant" />
          Change Password
        </button>
      </div>
    </div>
  )
}

export default ProfileSummaryCard
