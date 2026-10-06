import { BadgeCheck, MailCheck, ShieldCheck, Timer } from 'lucide-react'
import AuthPageShell from '../../features/auth/components/AuthPageShell'
import VerifyEmailForm from '../../features/auth/components/VerifyEmailForm'

const benefits = [
  { icon: MailCheck, text: 'A private 6-digit code is sent to your inbox' },
  { icon: Timer, text: 'Codes expire after 5 minutes for your security' },
  { icon: ShieldCheck, text: 'Your account activates only after verification' },
]

function VerifyEmailPage() {
  return (
    <AuthPageShell eyebrow={<><BadgeCheck className="size-4" /> One last step</>} title="Verify your F-Cinema membership." description="Confirm your email to protect your account and start booking your next big-screen experience." benefits={benefits}>
      <VerifyEmailForm />
    </AuthPageShell>
  )
}

export default VerifyEmailPage
