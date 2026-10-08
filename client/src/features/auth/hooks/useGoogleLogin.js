import { useState } from 'react'
import { getCurrentAccountRequest, googleLoginRequest } from '../api/authApi'
import { useAuthStore } from '../store/authStore'

export function useGoogleLogin() {
  const [isPending, setIsPending] = useState(false)
  const setAccount = useAuthStore((state) => state.setAccount)

  const loginWithGoogle = async (credential, rememberMe = false) => {
    setIsPending(true)

    try {
      await googleLoginRequest({ credential, rememberMe })
      const account = await getCurrentAccountRequest()
      setAccount(account)
      return account
    } finally {
      setIsPending(false)
    }
  }

  return { loginWithGoogle, isPending }
}
