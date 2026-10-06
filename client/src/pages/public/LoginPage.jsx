import { Armchair, BadgeCheck, Clapperboard, Sparkles } from 'lucide-react'
import AuthPageShell from '../../features/auth/components/AuthPageShell'
import LoginForm from '../../features/auth/components/LoginForm'

const benefits = [
  { icon: Clapperboard, text: 'Book tickets in seconds' },
  { icon: Armchair, text: 'Save your favorite seats' },
  { icon: Sparkles, text: 'Unlock exclusive F-Club rewards' },
]

function LoginPage() {
  return (
    <AuthPageShell
      eyebrow={<><BadgeCheck className="size-4" /> F-Club members</>}
      title="Your next great cinema experience starts here."
      description="Sign in to keep every premiere, reward and unforgettable big-screen moment within reach."
      benefits={benefits}
    >
      <LoginForm />
    </AuthPageShell>
  )
}

export default LoginPage
