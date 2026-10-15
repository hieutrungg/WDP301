import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useGoogleLogin } from '../hooks/useGoogleLogin'
import { getLoginDestination } from '../utils/loginDestination'
import GoogleCredentialButton from './GoogleCredentialButton'

function GoogleSignInButton({ onError, rememberMe = false }) {
  const { loginWithGoogle, isPending } = useGoogleLogin()
  const navigate = useNavigate()
  const location = useLocation()

  const handleCredential = async (credential) => {
    onError?.('')

    try {
      const account = await loginWithGoogle(credential, rememberMe)
      toast.success('Welcome to F-Cinema!')
      navigate(getLoginDestination(account, location.state?.from?.pathname), { replace: true })
    } catch (error) {
      const message = getApiErrorMessage(error)
      onError?.(message)
      toast.error(message)
    }
  }

  return <GoogleCredentialButton onCredential={handleCredential} disabled={isPending} />
}

export default GoogleSignInButton
