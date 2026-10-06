import { BadgeCheck, Cake, Percent, TicketCheck } from 'lucide-react'
import AuthPageShell from '../../features/auth/components/AuthPageShell'
import RegisterForm from '../../features/auth/components/RegisterForm'

const benefits = [
  { icon: Percent, text: 'Earn F-Points on tickets and concessions' },
  { icon: TicketCheck, text: 'Access member-only premieres and offers' },
  { icon: Cake, text: 'Enjoy birthday gifts and member Wednesdays' },
]

function RegisterPage() {
  return (
    <AuthPageShell eyebrow={<><BadgeCheck className="size-4" /> F-Club exclusive privileges</>} title="Join the ultimate cinema community." description="Unlock rewards, priority experiences, and effortless booking with your F-Cinema account." benefits={benefits}>
      <RegisterForm />
    </AuthPageShell>
  )
}

export default RegisterPage
