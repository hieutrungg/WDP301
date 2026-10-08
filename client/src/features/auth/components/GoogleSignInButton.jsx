import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useGoogleLogin } from '../hooks/useGoogleLogin'
import GoogleCredentialButton from './GoogleCredentialButton'

function GoogleSignInButton({ onError, rememberMe = false }) {
  const { loginWithGoogle, isPending } = useGoogleLogin()
  const navigate = useNavigate()
  const location = useLocation()

  const handleCredential = async (credential) => {
    onError?.('')

    try {
      await loginWithGoogle(credential, rememberMe)
      toast.success('Welcome to F-Cinema!')
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (error) {
      const message = getApiErrorMessage(error)
      onError?.(message)
      toast.error(message)
    }
  }

  return <GoogleCredentialButton onCredential={handleCredential} disabled={isPending} />
}

export default GoogleSignInButton
