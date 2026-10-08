import { ChevronRight, House, KeyRound, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import ChangePasswordModal from '../components/ChangePasswordModal'
import EditProfileModal from '../components/EditProfileModal'
import PersonalInfoSection from '../components/PersonalInfoSection'
import ProfileSummaryCard from '../components/ProfileSummaryCard'

function ProfilePage() {
  const { account } = useAuth()
  const [modal, setModal] = useState(null)
  const closeModal = () => setModal(null)
  const openEditProfile = () => setModal('edit')
  const openChangePassword = () => setModal('password')

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-surface-container-lowest to-background pt-20">
      <div className="pointer-events-none absolute -top-32 right-1/4 size-96 rounded-full bg-primary-container/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 -left-20 size-80 rounded-full bg-surface-container-high/40 blur-[120px]" />

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Link to="/" className="flex items-center gap-1 transition-colors hover:text-on-surface">
            <House className="size-4" />
            Home
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span>Customer Account</span>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="font-semibold text-on-surface">My Profile</span>
        </nav>

        <div className="flex flex-col justify-between gap-4 pb-1 md:flex-row md:items-end">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(229,9,20,0.8)]" />
              <span className="text-[11px] leading-[14px] font-bold tracking-widest text-primary uppercase">
                Customer Portal
              </span>
            </div>
            <h1 className="font-heading text-[28px] leading-9 font-bold tracking-tight text-on-surface">
              My Profile
            </h1>
            <p className="text-sm text-on-surface-variant">
              Manage your personal account details and access credentials.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openEditProfile}
              className="group flex items-center gap-1.5 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-container-high"
            >
              <Pencil className="size-[18px] text-on-surface-variant transition-colors group-hover:text-on-surface" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={openChangePassword}
              className="group flex items-center gap-1.5 rounded-lg bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-variant"
            >
              <KeyRound className="size-[18px] text-on-surface-variant transition-colors group-hover:text-primary" />
              Change Password
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ProfileSummaryCard
              account={account}
              onEditProfile={openEditProfile}
              onChangePassword={openChangePassword}
            />
          </div>
          <div className="lg:col-span-8">
            <PersonalInfoSection
              account={account}
              onEditProfile={openEditProfile}
              onChangePassword={openChangePassword}
            />
          </div>
        </div>
      </div>
      {modal === 'edit' && <EditProfileModal account={account} onClose={closeModal} />}
      {modal === 'password' && <ChangePasswordModal onClose={closeModal} />}
    </div>
  )
}

export default ProfilePage
