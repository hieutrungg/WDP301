import { CalendarDays, CircleCheck, IdCard, Info, KeyRound, MapPin, Pencil } from 'lucide-react'
import { formatAccountStatus, formatDate } from '../utils/accountFormat'

function InfoCard({ label, value, hint, badge }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 transition-colors hover:bg-surface-container-high">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] leading-[14px] font-bold tracking-wider text-on-surface-variant uppercase">
          {label}
        </span>
        {badge}
      </div>
      <span
        className={`mt-1 truncate font-heading text-lg font-semibold ${value ? 'text-on-surface' : 'text-on-surface-variant/60'}`}
      >
        {value || 'Not provided'}
      </span>
      <span className="text-xs text-on-surface-variant">{hint}</span>
    </div>
  )
}

const verifiedBadge = (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-0.5 text-[11px] leading-[14px] font-bold text-emerald-400">
    <CircleCheck className="size-3" />
    Verified
  </span>
)

function PersonalInfoSection({ account, onEditProfile, onChangePassword }) {
  const isActive = account.status === 'ACTIVE'

  return (
    <div className="flex flex-col gap-10 rounded-xl bg-surface-container-low p-6 shadow-xl md:p-10">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <IdCard className="size-5 text-primary" />
            <h3 className="font-heading text-[22px] leading-[30px] font-bold text-on-surface">
              Personal Information
            </h3>
          </div>
          <p className="text-sm text-on-surface-variant">
            Your personal contact and identity details used for booking notifications and ticket
            delivery.
          </p>
        </div>
        <span className="self-start rounded-full bg-surface-container-highest px-4 py-1 text-[11px] leading-[14px] font-medium tracking-wider text-on-surface-variant md:self-auto">
          READ ONLY VIEW
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard
          label="Full Name"
          value={account.profile?.fullName}
          hint="Name shown on your bookings"
        />
        <InfoCard
          label="Username"
          value={account.username}
          hint="Unique account identifier"
          badge={<span className="text-[11px] font-bold text-on-surface-variant">Immutable ID</span>}
        />
        <InfoCard
          label="Email Address"
          value={account.email}
          hint="Used for e-ticket delivery & receipts"
          badge={isActive ? verifiedBadge : null}
        />
        <InfoCard
          label="Phone Number"
          value={account.phone}
          hint="Used for booking contact"
        />
        <InfoCard
          label="Date of Birth"
          value={formatDate(account.profile?.dateOfBirth)}
          hint="Used for age-rated screenings"
          badge={<CalendarDays className="size-4 text-on-surface-variant" />}
        />
        <InfoCard
          label="Address"
          value={account.profile?.address}
          hint="Your contact address"
          badge={<MapPin className="size-4 text-on-surface-variant" />}
        />
        <InfoCard
          label="Account Status"
          value={formatAccountStatus(account.status)}
          hint={isActive ? 'Full booking privileges enabled' : 'Booking may be restricted'}
          badge={
            <span
              className={`size-2.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-on-surface-variant'}`}
            />
          }
        />
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-surface-container-highest/60 p-4 sm:flex-row">
        <div className="flex items-center gap-2 text-left">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-container-high">
            <Info className="size-[18px] text-on-surface-variant" />
          </span>
          <p className="text-xs text-on-surface-variant">
            Need to update your personal details or password? Click{' '}
            <strong className="font-semibold text-on-surface">Edit Profile</strong> or{' '}
            <strong className="font-semibold text-on-surface">Change Password</strong>.
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-1 sm:w-auto">
          <button
            type="button"
            onClick={onEditProfile}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface-container px-4 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-variant sm:flex-initial"
          >
            <Pencil className="size-4" />
            Edit Profile
          </button>
          <button
            type="button"
            onClick={onChangePassword}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface-container px-4 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-variant sm:flex-initial"
          >
            <KeyRound className="size-4" />
            Change Password
          </button>
        </div>
      </div>
    </div>
  )
}

export default PersonalInfoSection
