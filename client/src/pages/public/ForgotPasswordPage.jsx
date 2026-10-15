import { KeyRound, MailCheck, ShieldCheck, Timer } from 'lucide-react'
import AuthPageShell from '../../features/auth/components/AuthPageShell'
import ForgotPasswordForm from '../../features/auth/components/ForgotPasswordForm'

const benefits = [
  { icon: MailCheck, text: 'A private 6-digit code is sent to your registered email' },
  { icon: Timer, text: 'Codes expire after 5 minutes for your security' },
  { icon: ShieldCheck, text: 'Each code can be used only once' },
]

function ForgotPasswordPage() {
  return (
    <AuthPageShell
      eyebrow={<><KeyRound className="size-4" /> Account recovery</>}
      title="Get back to your next premiere."
      description="Reset your password in a few steps and keep every booking, reward and big-screen moment within reach."
      benefits={benefits}
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}

export default ForgotPasswordPage
